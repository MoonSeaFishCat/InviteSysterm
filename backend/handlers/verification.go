package handlers

import (
	"database/sql"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"invite-backend/database"
	"invite-backend/models"
	"invite-backend/services"

	"github.com/gin-gonic/gin"
)

// SendVerificationCode 发送验证码
func SendVerificationCode(c *gin.Context) {
	var req struct {
		Email         string `json:"email" binding:"required,email"`
		CaptchaAnswer string `json:"captchaAnswer" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 统一转为小写并去空格
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// 验证人机验证
	storedAnswer, err := c.Cookie("captcha_answer")
	if err != nil || storedAnswer != req.CaptchaAnswer {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "验证问答错误"})
		return
	}
	// 清除验证码 cookie
	c.SetCookie("captcha_answer", "", -1, "/", "", false, true)

	settings, err := services.GetSystemSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}

	// 检查申请是否开放
	if settings["application_open"] == "false" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "申请通道暂未开放，请稍后再试"})
		return
	}

	// 检查白名单
	whitelist := strings.TrimSpace(settings["email_whitelist"])
	if whitelist != "" {
		domains := strings.Split(whitelist, ",")
		emailParts := strings.Split(req.Email, "@")
		if len(emailParts) != 2 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "邮箱格式错误"})
			return
		}
		emailDomain := strings.ToLower(emailParts[1])

		whitelisted := false
		for _, d := range domains {
			d = strings.ToLower(strings.TrimSpace(d))
			if d == emailDomain || d == strings.ToLower(req.Email) {
				whitelisted = true
				break
			}
		}

		if !whitelisted {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "该邮箱不在允许的白名单内"})
			return
		}
	}

	// 检查是否已申请
	var count int
	err = database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE email = ?", req.Email).Scan(&count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该邮箱已提交过申请"})
		return
	}

	// 生成验证码
	code := fmt.Sprintf("%06d", rand.Intn(900000)+100000)
	expiresAt := time.Now().Add(10 * time.Minute).Unix()

	// 保存验证码
	_, err = database.DB.Exec(
		"INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)",
		req.Email, code, expiresAt,
	)
	if err != nil {
		fmt.Printf("Failed to save verification code for %s: %v\n", req.Email, err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "验证码生成失败"})
		return
	}
	fmt.Printf("Generated verification code for %s: %s, expiresAt: %d\n", req.Email, code, expiresAt)

	// 发送邮件
	emailService, err := services.GetEmailService()
	if err != nil {
		// SMTP 未配置，仅打印验证码
		fmt.Printf("Verification code for %s: %s (SMTP not configured)\n", req.Email, code)
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "验证码已发送（开发模式：" + code + "）"})
		return
	}

	if err := emailService.SendVerificationCode(req.Email, code); err != nil {
		fmt.Printf("Failed to send email: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "验证码发送失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "验证码已发送"})
}

// GetCaptcha 生成验证码问题
func GetCaptcha(c *gin.Context) {
	a := rand.Intn(10) + 1
	b := rand.Intn(10) + 1
	question := fmt.Sprintf("%d + %d", a, b)
	answer := fmt.Sprintf("%d", a+b)

	// 将答案存储在 cookie 中
	c.SetCookie("captcha_answer", answer, 300, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{"question": question})
}

// GetSecurityChallenge PoW 挑战
func GetSecurityChallenge(c *gin.Context) {
	salt := fmt.Sprintf("%x", rand.Int63())
	difficulty := 4

	c.JSON(http.StatusOK, gin.H{
		"salt":       salt,
		"difficulty": difficulty,
	})
}

// GetStats 获取统计信息
func GetStats(c *gin.Context) {
	var total, pending, approved, rejected, processed int

	database.DB.QueryRow("SELECT COUNT(*) FROM applications").Scan(&total)
	database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status = 'pending'").Scan(&pending)
	database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status = 'approved'").Scan(&approved)
	database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status = 'rejected'").Scan(&rejected)
	database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status != 'pending'").Scan(&processed)

	settings, _ := services.GetSystemSettings()
	isOpen := settings["application_open"] != "false"

	c.JSON(http.StatusOK, gin.H{
		"total":             total,
		"pending":           pending,
		"approved":          approved,
		"rejected":          rejected,
		"processed":         processed,
		"isApplicationOpen": isOpen,
		"siteName":          settings["site_name"],
		"announcement":      settings["home_announcement"],
	})
}

// CheckApplicationStatus 检查申请状态
func CheckApplicationStatus(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "邮箱格式错误"})
		return
	}

	var app models.Application
	var createdAtVal interface{}
	var adminNote sql.NullString
	var appID int

	err := database.DB.QueryRow(`
		SELECT id, email, status, reason, admin_note, created_at 
		FROM applications 
		WHERE email = ? 
		ORDER BY created_at DESC LIMIT 1
	`, req.Email).Scan(&appID, &app.Email, &app.Status, &app.Reason, &adminNote, &createdAtVal)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到相关申请记录"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询失败"})
		return
	}

	app.ID = appID
	app.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
	if adminNote.Valid {
		app.AdminNote = adminNote.String
	}

	// 如果已批准，获取邀请码
	var inviteCode string
	if app.Status == "approved" {
		database.DB.QueryRow("SELECT code FROM invitation_codes WHERE application_id = ?", appID).Scan(&inviteCode)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"email":      app.Email,
			"status":     app.Status,
			"reason":     app.Reason,
			"adminNote":  app.AdminNote,
			"createdAt":  app.CreatedAt,
			"inviteCode": inviteCode,
		},
	})
}

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
	"invite-backend/utils"

	"github.com/gin-gonic/gin"
)

// SendRegistrationCode 发送注册验证码
func SendRegistrationCode(c *gin.Context) {
	var req struct {
		Encrypted   string `json:"encrypted" binding:"required"`
		Fingerprint string `json:"fingerprint" binding:"required"`
		Nonce       int    `json:"nonce" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 解密数据
	security := &utils.StarMoonSecurity{}
	data, err := security.DecryptData(req.Encrypted, req.Fingerprint, req.Nonce)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "安全校验失败"})
		return
	}

	email, _ := data["email"].(string)
	lotNumber, _ := data["lot_number"].(string)
	captchaOutput, _ := data["captcha_output"].(string)
	passToken, _ := data["pass_token"].(string)
	genTime, _ := data["gen_time"].(string)

	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "邮箱不能为空"})
		return
	}

	settings, _ := services.GetSystemSettings()

	// 验证极验4.0
	if settings["geetest_enabled"] == "true" {
		if lotNumber == "" || captchaOutput == "" || passToken == "" || genTime == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请先完成人机验证"})
			return
		}
		var ok bool
		ok, err = utils.VerifyGeetestV4(
			settings["geetest_id"],
			settings["geetest_key"],
			lotNumber,
			captchaOutput,
			passToken,
			genTime,
		)
		if err != nil || !ok {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "人机验证失败"})
			return
		}
	}

	// 检查邮箱是否已注册
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE email = ?", email).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该邮箱已注册"})
		return
	}

	// 检查发送频率限制（防止阿里云反垃圾邮件限制）
	var lastSendTime int64
	err = database.DB.QueryRow(
		"SELECT created_at FROM verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1",
		email,
	).Scan(&lastSendTime)

	if err == nil {
		// 如果上次发送时间在60秒内，则拒绝重复发送
		timeSinceLastSend := time.Now().Unix() - lastSendTime
		if timeSinceLastSend < 60 {
			remainingTime := 60 - timeSinceLastSend
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"message": fmt.Sprintf("发送过于频繁，请 %d 秒后再试", remainingTime),
			})
			return
		}
	}

	// 生成验证码
	code := fmt.Sprintf("%06d", rand.Intn(900000)+100000)
	expiresAt := time.Now().Add(10 * time.Minute).Unix()

	// 保存验证码
	_, err = database.DB.Exec(
		"INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)",
		email, code, expiresAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "验证码生成失败"})
		return
	}

	// 发送邮件
	fmt.Printf("[DEBUG] 开始发送邮件到: %s\n", email)
	fmt.Printf("[DEBUG] SMTP配置 - Host: %s, Port: %s, User: %s\n",
		settings["smtp_host"], settings["smtp_port"], settings["smtp_user"])

	emailService, err := services.GetEmailService()
	if err != nil {
		// 如果邮件服务未配置，返回开发模式提示（但仍然是 success: true）
		fmt.Printf("[DEBUG] 邮件服务获取失败: %v\n", err)
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "验证码已生成（开发模式：" + code + "）", "dev_mode": true})
		return
	}

	fmt.Printf("[DEBUG] 邮件服务初始化成功，开始发送验证码\n")
	if err := emailService.SendVerificationCode(email, code); err != nil {
		// 记录详细错误日志
		fmt.Printf("[ERROR] 邮件发送失败: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": fmt.Sprintf("邮件发送失败: %v", err)})
		return
	}

	fmt.Printf("[DEBUG] 验证码邮件发送成功\n")

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "验证码已发送至您的邮箱"})
}

// SendVerificationCode 发送验证码 (通用/申请)
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

// GetPublicStats 获取公共统计信息
func GetPublicStats(c *gin.Context) {
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
		"geetest_id":        settings["geetest_id"],
		"geetest_enabled":   settings["geetest_enabled"],
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

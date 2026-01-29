package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"invite-backend/database"
	"invite-backend/services"
	"invite-backend/utils"

	"github.com/gin-gonic/gin"
)

// SubmitApplication 提交申请
func SubmitApplication(c *gin.Context) {
	// 获取登录用户
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "请登录后提交申请"})
		return
	}
	userEmail, _ := c.Get("user_email")

	var req struct {
		Encrypted   string `json:"encrypted" binding:"required"`
		Fingerprint string `json:"fingerprint" binding:"required"`
		Nonce       int    `json:"nonce" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 1. 解密数据
	security := &utils.StarMoonSecurity{}
	data, err := security.DecryptData(req.Encrypted, req.Fingerprint, req.Nonce)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "安全校验失败：" + err.Error()})
		return
	}

	email, _ := data["email"].(string)
	reason, _ := data["reason"].(string)

	// 统一转为小写并去空格
	email = strings.ToLower(strings.TrimSpace(email))

	// 强制要求提交的邮箱必须是登录账号的邮箱
	if email != userEmail.(string) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "只能为当前登录账号申请"})
		return
	}

	if email == "" || reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "提交内容不完整"})
		return
	}

	// 增加申请理由字数限制（最少 50 字）
	if len([]rune(reason)) < 50 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "申请理由不能少于 50 个字，请认真填写"})
		return
	}

	ip := c.ClientIP()
	settings, _ := services.GetSystemSettings()

	// 1.5 检查申请是否开放
	if settings["application_open"] == "false" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "申请通道暂未开放，请稍后再试"})
		return
	}

	if settings["risk_control_enabled"] == "true" {
		// 检查是否有未拒绝的申请
		var count int
		database.DB.QueryRow(
			"SELECT COUNT(*) FROM applications WHERE (email = ? OR device_id = ? OR user_id = ?) AND status IN ('pending', 'approved')",
			email, req.Fingerprint, userID,
		).Scan(&count)

		if count > 0 {
			var status string
			database.DB.QueryRow(
				"SELECT status FROM applications WHERE (email = ? OR device_id = ? OR user_id = ?) AND status IN ('pending', 'approved') LIMIT 1",
				email, req.Fingerprint, userID,
			).Scan(&status)

			msg := "您已有正在处理中的申请，请耐心等待"
			if status == "approved" {
				msg = "您已申请成功，请查看邮件"
			}
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": msg})
			return
		}

		// 检查同 IP 提交上限
		var ipCount int
		database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE ip = ? AND created_at > ?", ip, time.Now().Unix()-86400).Scan(&ipCount)
		maxIP, _ := strconv.Atoi(settings["max_applications_per_ip"])
		if maxIP > 0 && ipCount >= maxIP {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "当前 IP 提交次数过多，请明天再试"})
			return
		}
	}

	// 4. 插入申请
	now := time.Now().Unix()
	res, err := database.DB.Exec(
		"INSERT INTO applications (user_id, email, reason, device_id, ip, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		userID, email, reason, req.Fingerprint, ip, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交失败，请重试"})
		return
	}

	appID, _ := res.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "申请已提交，请等待审核", "id": appID})
}

// GetUserApplications 获取当前用户的申请记录
func GetUserApplications(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rows, err := database.DB.Query(`
		SELECT a.id, a.email, a.reason, a.status, a.review_opinion, a.created_at, a.updated_at, i.code
		FROM applications a
		LEFT JOIN invitation_codes i ON a.id = i.application_id
		WHERE a.user_id = ? 
		ORDER BY a.created_at DESC`,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}
	defer rows.Close()

	var apps []map[string]interface{}
	for rows.Next() {
		var id int
		var email, reason, status string
		var opinion, code sql.NullString
		var createdAt, updatedAt int64
		err = rows.Scan(&id, &email, &reason, &status, &opinion, &createdAt, &updatedAt, &code)
		if err != nil {
			continue
		}

		app := map[string]interface{}{
			"id":              id,
			"email":           email,
			"reason":          reason,
			"status":          status,
			"review_opinion":  opinion.String,
			"created_at":      createdAt,
			"updated_at":      updatedAt,
			"invitation_code": code.String,
		}
		apps = append(apps, app)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": apps})
}

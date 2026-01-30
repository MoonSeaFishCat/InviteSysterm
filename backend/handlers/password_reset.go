package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"invite-backend/database"
	"invite-backend/services"
	"invite-backend/utils"

	"github.com/gin-gonic/gin"
)

// RequestPasswordReset 请求密码重置
func RequestPasswordReset(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请输入有效的邮箱地址"})
		return
	}

	// 检查用户是否存在
	var userID int
	var email string
	err := database.DB.QueryRow("SELECT id, email FROM users WHERE email = ?", req.Email).Scan(&userID, &email)
	if err != nil {
		// 为了安全，即使用户不存在也返回成功，防止邮箱枚举攻击
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "如果该邮箱已注册，您将收到密码重置邮件"})
		return
	}

	// 检查是否在短时间内已经发送过重置邮件（防止滥用）
	var lastRequestTime int64
	err = database.DB.QueryRow(
		"SELECT created_at FROM password_reset_tokens WHERE email = ? ORDER BY created_at DESC LIMIT 1",
		email,
	).Scan(&lastRequestTime)

	if err == nil && time.Now().Unix()-lastRequestTime < 60 {
		c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "message": "请求过于频繁，请稍后再试"})
		return
	}

	// 生成重置令牌（32字节随机字符串）
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "生成重置令牌失败"})
		return
	}
	token := hex.EncodeToString(tokenBytes)

	// 令牌有效期：30分钟
	expiresAt := time.Now().Add(30 * time.Minute).Unix()

	// 保存令牌到数据库
	_, err = database.DB.Exec(
		"INSERT INTO password_reset_tokens (email, token, expires_at, created_at) VALUES (?, ?, ?, ?)",
		email, token, expiresAt, time.Now().Unix(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存重置令牌失败"})
		return
	}

	// 发送重置邮件
	emailService, err := services.GetEmailService()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "邮件服务未配置"})
		return
	}

	// 异步发送邮件
	go func(targetEmail, resetToken string) {
		emailService.SendPasswordResetEmail(targetEmail, resetToken)
	}(email, token)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "密码重置邮件已发送，请查收"})
}

// VerifyResetToken 验证重置令牌
func VerifyResetToken(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "缺少重置令牌"})
		return
	}

	var email string
	var expiresAt int64
	err := database.DB.QueryRow(
		"SELECT email, expires_at FROM password_reset_tokens WHERE token = ? AND used = 0",
		token,
	).Scan(&email, &expiresAt)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的重置令牌"})
		return
	}

	if time.Now().Unix() > expiresAt {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "重置令牌已过期"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "email": email})
}

// ResetPassword 重置密码
func ResetPassword(c *gin.Context) {
	var req struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"newPassword" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误，密码至少6个字符"})
		return
	}

	// 验证令牌
	var email string
	var expiresAt int64
	err := database.DB.QueryRow(
		"SELECT email, expires_at FROM password_reset_tokens WHERE token = ? AND used = 0",
		req.Token,
	).Scan(&email, &expiresAt)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的重置令牌"})
		return
	}

	if time.Now().Unix() > expiresAt {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "重置令牌已过期，请重新申请"})
		return
	}

	// 更新密码
	passwordHash := utils.HashPassword(req.NewPassword)
	_, err = database.DB.Exec(
		"UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?",
		passwordHash, time.Now().Unix(), email,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "密码重置失败"})
		return
	}

	// 标记令牌为已使用
	_, _ = database.DB.Exec("UPDATE password_reset_tokens SET used = 1 WHERE token = ?", req.Token)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "密码重置成功，请使用新密码登录"})
}


package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"invite-backend/config"
	"invite-backend/middleware"
	"invite-backend/services"
	"invite-backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AdminLogin 管理员登录
func AdminLogin(c *gin.Context) {
	var req struct {
		Encrypted     string `json:"encrypted" binding:"required"`
		Fingerprint   string `json:"fingerprint" binding:"required"`
		Nonce         int    `json:"nonce" binding:"required"`
		CaptchaAnswer string `json:"captchaAnswer" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 1. 验证验证码
	storedAnswer, err := c.Cookie("captcha_answer")
	if err != nil || storedAnswer != req.CaptchaAnswer {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "验证码错误"})
		return
	}
	// 清除验证码 cookie
	c.SetCookie("captcha_answer", "", -1, "/", "", false, true)

	// 2. 解密数据
	security := &utils.StarMoonSecurity{}
	data, err := security.DecryptData(req.Encrypted, req.Fingerprint, req.Nonce)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "安全校验失败"})
		return
	}

	username, _ := data["username"].(string)
	password, _ := data["password"].(string)

	// 3. 验证用户名和密码
	settings, _ := services.GetSystemSettings()
	hashedPassword := utils.HashPassword(password)

	if username != settings["admin_username"] || hashedPassword != settings["admin_password_hash"] {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "用户名或密码错误"})
		return
	}

	// 生成 JWT Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"admin": true,
		"exp":   time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "生成 Token 失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   tokenString,
	})
}

// AdminLogout 管理员登出
func AdminLogout(c *gin.Context) {
	sessionID, _ := c.Cookie("admin_session")
	delete(middleware.SessionStore, sessionID)

	c.SetCookie("admin_session", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ChangePassword 修改管理员信息（支持用户名和密码）
func ChangePassword(c *gin.Context) {
	var req struct {
		CurrentPassword string `json:"currentPassword" binding:"required"`
		NewUsername     string `json:"newUsername"`
		NewPassword     string `json:"newPassword"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if req.NewUsername == "" && req.NewPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "至少需要修改一项信息"})
		return
	}

	settings, _ := services.GetSystemSettings()
	currentHash := utils.HashPassword(req.CurrentPassword)

	if currentHash != settings["admin_password_hash"] {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "当前密码错误"})
		return
	}

	updates := make(map[string]string)
	if req.NewUsername != "" {
		updates["admin_username"] = req.NewUsername
	}
	if req.NewPassword != "" {
		if len(req.NewPassword) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "新密码至少需要6个字符"})
			return
		}
		updates["admin_password_hash"] = utils.HashPassword(req.NewPassword)
	}

	err := services.UpdateSettings(updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "修改失败"})
		return
	}

	// 如果修改了密码，清除所有会话
	if req.NewPassword != "" {
		middleware.SessionStore = make(map[string]bool)
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "修改成功，请重新登录", "relogin": true})
	} else {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "修改成功"})
	}
}

func generateSessionID() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

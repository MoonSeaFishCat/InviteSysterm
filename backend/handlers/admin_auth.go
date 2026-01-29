package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"invite-backend/config"
	"invite-backend/database"
	"invite-backend/middleware"
	"invite-backend/services"
	"invite-backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// getLinuxDoConfig 从数据库获取 Linux DO 配置
func getLinuxDoConfig() (string, string) {
	var clientID, clientSecret string
	database.DB.QueryRow("SELECT value FROM settings WHERE key = 'linuxdo_client_id'").Scan(&clientID)
	database.DB.QueryRow("SELECT value FROM settings WHERE key = 'linuxdo_client_secret'").Scan(&clientSecret)
	return clientID, clientSecret
}

// getRedirectURI 自动生成回调地址
func getRedirectURI(c *gin.Context) string {
	scheme := "http"
	if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/api/admin/linuxdo/callback", scheme, c.Request.Host)
}

// LinuxDoLogin 跳转到 Linux DO 授权页
func LinuxDoLogin(c *gin.Context) {
	clientID, _ := getLinuxDoConfig()
	redirectURI := getRedirectURI(c)

	if clientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "未配置 Linux DO 登录"})
		return
	}

	authURL := fmt.Sprintf("https://connect.linux.do/oauth2/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=user",
		url.QueryEscape(clientID),
		url.QueryEscape(redirectURI),
	)

	c.Redirect(http.StatusFound, authURL)
}

// LinuxDoCallback 处理 Linux DO 回调
func LinuxDoCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.String(http.StatusBadRequest, "授权码缺失")
		return
	}

	clientID, clientSecret := getLinuxDoConfig()
	redirectURI := getRedirectURI(c)

	// 1. 换取 Access Token
	tokenURL := "https://connect.linux.do/oauth2/token"
	formData := url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		},
	}

	resp, err := client.PostForm(tokenURL, formData)
	if err != nil {
		fmt.Printf("Token request failed: %v\n", err)
		c.String(http.StatusInternalServerError, fmt.Sprintf("获取访问令牌失败: %v", err))
		return
	}
	defer resp.Body.Close()

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		c.String(http.StatusInternalServerError, "解析令牌失败")
		return
	}

	if tokenRes.Error != "" {
		c.String(http.StatusBadRequest, "授权失败: "+tokenRes.Error)
		return
	}

	// 2. 获取用户信息
	userReq, _ := http.NewRequest("GET", "https://connect.linux.do/api/user", nil)
	userReq.Header.Set("Authorization", "Bearer "+tokenRes.AccessToken)
	userReq.Header.Set("Accept", "application/json")

	userResp, err := client.Do(userReq)
	if err != nil {
		fmt.Printf("User info request failed: %v\n", err)
		c.String(http.StatusInternalServerError, fmt.Sprintf("获取用户信息失败: %v", err))
		return
	}
	defer userResp.Body.Close()

	var userInfo struct {
		ID         int    `json:"id"`
		Username   string `json:"username"`
		TrustLevel int    `json:"trust_level"`
	}
	if err := json.NewDecoder(userResp.Body).Decode(&userInfo); err != nil {
		c.String(http.StatusInternalServerError, "解析用户信息失败")
		return
	}

	// 3. 校验信任等级
	settings, _ := services.GetSystemSettings()
	minLevelStr := settings["linuxdo_min_trust_level"]
	minLevel, _ := strconv.Atoi(minLevelStr)
	if minLevel <= 0 {
		minLevel = 3 // 默认 3 级
	}

	if userInfo.TrustLevel < minLevel {
		c.String(http.StatusForbidden, fmt.Sprintf("权限不足：您的 Linux DO 信任等级需达到 %d 级以上才能登录管理后台", minLevel))
		return
	}

	// 4. 在数据库中查找或创建管理员
	linuxDoID := strconv.Itoa(userInfo.ID)
	var id int
	var role string
	var dbUsername string

	err = database.DB.QueryRow("SELECT id, username, role FROM admins WHERE linuxdo_id = ?", linuxDoID).Scan(&id, &dbUsername, &role)
	if err != nil {
		// 检查是否允许自动注册
		if settings["allow_auto_admin_reg"] == "false" {
			c.String(http.StatusForbidden, "系统已关闭自动注册，请联系超级管理员手动添加。")
			return
		}

		// 如果不存在，则创建（默认 role 为 reviewer）
		now := time.Now().Unix()
		res, err := database.DB.Exec(
			"INSERT INTO admins (username, role, linuxdo_id, created_at, updated_at) VALUES (?, 'reviewer', ?, ?, ?)",
			userInfo.Username, linuxDoID, now, now,
		)
		if err != nil {
			fmt.Printf("First insert failed: %v\n", err)
			// 如果用户名冲突（可能已被其他管理员手动注册），则尝试加后缀
			res, err = database.DB.Exec(
				"INSERT INTO admins (username, role, linuxdo_id, created_at, updated_at) VALUES (?, 'reviewer', ?, ?, ?)",
				userInfo.Username+"_ld", linuxDoID, now, now,
			)
			if err != nil {
				fmt.Printf("Second insert failed: %v\n", err)
				c.String(http.StatusInternalServerError, fmt.Sprintf("创建管理员失败: %v", err))
				return
			}
		}
		newID, _ := res.LastInsertId()
		id = int(newID)
		role = "reviewer"
		dbUsername = userInfo.Username
	}

	// 5. 生成 JWT Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":       id,
		"username": dbUsername,
		"role":     role,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		c.String(http.StatusInternalServerError, "生成 Token 失败")
		return
	}

	// 6. 成功登录后重定向回前端，并带上 Token
	// 注意：在实际生产中，更好的方式是通过 Cookie 或特定的前端回调页处理
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, fmt.Sprintf(`<script>localStorage.setItem('admin_token', '%s'); window.location.href='/admin/dashboard';</script>`, tokenString))
}

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
	var id int
	var storedPasswordHash, role string
	err = database.DB.QueryRow("SELECT id, password_hash, role FROM admins WHERE username = ?", username).Scan(&id, &storedPasswordHash, &role)

	if err != nil || storedPasswordHash != utils.HashPassword(password) {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "用户名或密码错误"})
		return
	}

	// 生成 JWT Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":       id,
		"username": username,
		"role":     role,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
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

// GetMe 获取当前管理员信息
func GetMe(c *gin.Context) {
	username, _ := c.Get("admin_username")
	role, _ := c.Get("admin_role")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"username": username,
			"role":     role,
		},
	})
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

	adminID, _ := c.Get("admin_id")
	var currentStoredHash string
	err := database.DB.QueryRow("SELECT password_hash FROM admins WHERE id = ?", adminID).Scan(&currentStoredHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}

	currentHash := utils.HashPassword(req.CurrentPassword)
	if currentHash != currentStoredHash {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "当前密码错误"})
		return
	}

	if req.NewUsername != "" {
		_, err = database.DB.Exec("UPDATE admins SET username = ?, updated_at = ? WHERE id = ?", req.NewUsername, time.Now().Unix(), adminID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "用户名已存在或修改失败"})
			return
		}
	}

	if req.NewPassword != "" {
		if len(req.NewPassword) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "新密码至少需要6个字符"})
			return
		}
		newHash := utils.HashPassword(req.NewPassword)
		_, err = database.DB.Exec("UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?", newHash, time.Now().Unix(), adminID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "修改密码失败"})
			return
		}
	}

	// 如果修改了密码，通知前端重新登录
	if req.NewPassword != "" {
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

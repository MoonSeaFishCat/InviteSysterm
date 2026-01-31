package handlers

import (
	"net/http"
	"strings"
	"time"

	"invite-backend/config"
	"invite-backend/database"
	"invite-backend/services"
	"invite-backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// UserRegister 用户注册
func UserRegister(c *gin.Context) {
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
	password, _ := data["password"].(string)
	nickname, _ := data["nickname"].(string)
	code, _ := data["code"].(string)

	// 极验4.0 参数
	lotNumber, _ := data["lot_number"].(string)
	captchaOutput, _ := data["captcha_output"].(string)
	passToken, _ := data["pass_token"].(string)
	genTime, _ := data["gen_time"].(string)

	if email == "" || password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "信息不完整"})
		return
	}

	// 检查邮箱黑名单
	if CheckBlacklist("email", email) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "该邮箱已被禁止注册"})
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

	// 验证邮箱验证码
	if settings["reg_email_verify_enabled"] == "true" {
		if code == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请输入验证码"})
			return
		}
		var storedCode string
		var expiresAt int64
		err = database.DB.QueryRow(
			"SELECT code, expires_at FROM verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1",
			email,
		).Scan(&storedCode, &expiresAt)

		if err != nil || storedCode != code || time.Now().Unix() > expiresAt {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "验证码错误或已过期"})
			return
		}
	}

	// 检查邮箱白名单
	if whitelist := settings["email_whitelist"]; whitelist != "" {
		allowed := false
		domains := strings.Split(whitelist, ",")
		for _, domain := range domains {
			domain = strings.TrimSpace(domain)
			if domain == "" {
				continue
			}
			// 如果是域名（以 @ 开头），检查后缀
			if strings.HasPrefix(domain, "@") {
				if strings.HasSuffix(email, domain) {
					allowed = true
					break
				}
			} else if email == domain {
				// 如果是完整邮箱，检查全匹配
				allowed = true
				break
			}
		}
		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "该邮箱后缀不在白名单中，暂不支持注册"})
			return
		}
	}

	// 检查邮箱是否已存在
	var count int
	err = database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE email = ?", email).Scan(&count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该邮箱已注册"})
		return
	}

	passwordHash := utils.HashPassword(password)
	now := time.Now().Unix()

	_, err = database.DB.Exec(
		"INSERT INTO users (email, password_hash, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
		email, passwordHash, nickname, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "注册失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "注册成功"})
}

// UserLogin 用户登录
func UserLogin(c *gin.Context) {
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
	password, _ := data["password"].(string)

	// 极验4.0 参数
	lotNumber, _ := data["lot_number"].(string)
	captchaOutput, _ := data["captcha_output"].(string)
	passToken, _ := data["pass_token"].(string)
	genTime, _ := data["gen_time"].(string)

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

	var id int
	var storedHash, status, nickname string
	err = database.DB.QueryRow("SELECT id, password_hash, status, nickname FROM users WHERE email = ?", email).Scan(&id, &storedHash, &status, &nickname)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "账号或密码错误"})
		return
	}

	if status == "banned" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "账号已被禁用"})
		return
	}

	if utils.HashPassword(password) != storedHash {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "账号或密码错误"})
		return
	}

	// 生成 Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":    id,
		"email": email,
		"exp":   time.Now().Add(time.Hour * 72).Unix(), // 用户 Token 有效期长一点
	})

	tokenString, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "生成 Token 失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   tokenString,
		"user": gin.H{
			"id":       id,
			"email":    email,
			"nickname": nickname,
		},
	})
}

// GetUserProfile 获取用户信息
func GetUserProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user struct {
		ID        int    `json:"id"`
		Email     string `json:"email"`
		Nickname  string `json:"nickname"`
		CreatedAt int64  `json:"created_at"`
	}

	err := database.DB.QueryRow("SELECT id, email, nickname, created_at FROM users WHERE id = ?", userID).Scan(&user.ID, &user.Email, &user.Nickname, &user.CreatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "用户不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": user})
}

// GetUserProfileStats 获取用户统计信息
func GetUserProfileStats(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var stats struct {
		TotalApplications    int    `json:"total_applications"`
		ApprovedApplications int    `json:"approved_applications"`
		PendingApplications  int    `json:"pending_applications"`
		RegisterDate         string `json:"register_date"`
	}

	// 获取申请统计
	database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE user_id = ?", userID).Scan(&stats.TotalApplications)
	database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE user_id = ? AND status = 'approved'", userID).Scan(&stats.ApprovedApplications)
	database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE user_id = ? AND status = 'pending'", userID).Scan(&stats.PendingApplications)

	// 获取注册日期
	var createdAt int64
	database.DB.QueryRow("SELECT created_at FROM users WHERE id = ?", userID).Scan(&createdAt)
	stats.RegisterDate = time.Unix(createdAt, 0).Format("2006-01-02")

	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}

// WithdrawApplication 撤回申请
func WithdrawApplication(c *gin.Context) {
	userID, _ := c.Get("user_id")
	appID := c.Param("id")

	// 检查申请是否存在且属于当前用户
	var app struct {
		ID     int
		Email  string
		Status string
		UserID int
	}

	err := database.DB.QueryRow(
		"SELECT a.id, a.email, a.status, u.id as user_id FROM applications a LEFT JOIN users u ON a.email = u.email WHERE a.id = ?",
		appID,
	).Scan(&app.ID, &app.Email, &app.Status, &app.UserID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "申请不存在"})
		return
	}

	// 验证申请所有权
	if app.UserID != userID.(int) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权操作此申请"})
		return
	}

	// 只能撤回待审核的申请
	if app.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "只能撤回待审核的申请"})
		return
	}

	// 删除申请
	_, err = database.DB.Exec("DELETE FROM applications WHERE id = ?", appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "撤回失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "申请已撤回"})
}

// UpdateUserProfile 更新用户信息
func UpdateUserProfile(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req struct {
		Nickname string `json:"nickname"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if req.Nickname == "" && req.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "没有需要更新的内容"})
		return
	}

	now := time.Now().Unix()
	if req.Password != "" {
		if len(req.Password) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "密码长度不能少于 6 位"})
			return
		}
		passwordHash := utils.HashPassword(req.Password)
		if req.Nickname != "" {
			_, err := database.DB.Exec("UPDATE users SET nickname = ?, password_hash = ?, updated_at = ? WHERE id = ?", req.Nickname, passwordHash, now, userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
				return
			}
		} else {
			_, err := database.DB.Exec("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", passwordHash, now, userID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
				return
			}
		}
	} else if req.Nickname != "" {
		_, err := database.DB.Exec("UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?", req.Nickname, now, userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "更新成功"})
}

// ChangeUserPassword 修改用户密码
func ChangeUserPassword(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if req.OldPassword == "" || req.NewPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请填写完整信息"})
		return
	}

	if len(req.NewPassword) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "新密码长度不能少于 6 位"})
		return
	}

	// 验证旧密码
	var currentPasswordHash string
	err := database.DB.QueryRow("SELECT password_hash FROM users WHERE id = ?", userID).Scan(&currentPasswordHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询用户信息失败"})
		return
	}

	if !utils.CheckPassword(req.OldPassword, currentPasswordHash) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "当前密码错误"})
		return
	}

	// 更新密码
	newPasswordHash := utils.HashPassword(req.NewPassword)
	now := time.Now().Unix()
	_, err = database.DB.Exec("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", newPasswordHash, now, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新密码失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "密码修改成功"})
}

package handlers

import (
	"database/sql"
	"fmt"
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
	code, _ := data["code"].(string)
	reason, _ := data["reason"].(string)

	// 统一转为小写并去空格
	email = strings.ToLower(strings.TrimSpace(email))
	code = strings.TrimSpace(code)

	if email == "" || code == "" || reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "提交内容不完整"})
		return
	}

	ip := c.ClientIP()
	settings, _ := services.GetSystemSettings()

	// 1.5 检查申请是否开放
	if settings["application_open"] == "false" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "申请通道暂未开放，请稍后再试"})
		return
	}

	// 2. 验证验证码
	var storedCode string
	var expiresAtVal interface{}
	err = database.DB.QueryRow(
		"SELECT code, expires_at FROM verification_codes WHERE email = ? ORDER BY id DESC LIMIT 1",
		email,
	).Scan(&storedCode, &expiresAtVal)

	expiresAt := database.ToUnixTimestamp(expiresAtVal)

	if err == sql.ErrNoRows || storedCode != code || time.Now().Unix() > expiresAt {
		fmt.Printf("Verification failed for %s: input=%s, stored=%s, expiresAt=%d, now=%d, err=%v\n",
			email, code, storedCode, expiresAt, time.Now().Unix(), err)
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "验证码无效或已过期"})
		return
	}

	// 3. 风控检查
	if settings["risk_control_enabled"] == "true" {
		// 检查是否有未拒绝的申请
		var count int
		database.DB.QueryRow(
			"SELECT COUNT(*) FROM applications WHERE (email = ? OR device_id = ?) AND status IN ('pending', 'approved')",
			email, req.Fingerprint,
		).Scan(&count)

		if count > 0 {
			var status string
			database.DB.QueryRow(
				"SELECT status FROM applications WHERE (email = ? OR device_id = ?) AND status IN ('pending', 'approved') LIMIT 1",
				email, req.Fingerprint,
			).Scan(&status)

			msg := "您已有正在处理中的申请，请耐心等待"
			if status == "approved" {
				msg = "您已成功获得邀请码，暂不能重复提交"
			}
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": msg})
			return
		}

		// 邮箱限制（仅统计已通过）
		maxEmail, _ := strconv.Atoi(settings["max_applications_per_email"])
		if maxEmail == 0 {
			maxEmail = 1
		}
		var approvedEmailCount int
		database.DB.QueryRow(
			"SELECT COUNT(*) FROM applications WHERE email = ? AND status = 'approved'",
			email,
		).Scan(&approvedEmailCount)
		if approvedEmailCount >= maxEmail {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该邮箱已成功申请过邀请码"})
			return
		}

		// 设备限制（仅统计已通过）
		maxDevice, _ := strconv.Atoi(settings["max_applications_per_device"])
		if maxDevice == 0 {
			maxDevice = 1
		}
		var approvedDeviceCount int
		database.DB.QueryRow(
			"SELECT COUNT(*) FROM applications WHERE device_id = ? AND status = 'approved'",
			req.Fingerprint,
		).Scan(&approvedDeviceCount)
		if approvedDeviceCount >= maxDevice {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该设备已成功申请过邀请码"})
			return
		}
	}

	// 4. 插入申请
	_, err = database.DB.Exec(
		"INSERT INTO applications (email, reason, device_id, ip, status) VALUES (?, ?, ?, ?, 'pending')",
		email, reason, req.Fingerprint, ip,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交失败，请重试"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "申请提交成功，请耐心等待审核"})
}

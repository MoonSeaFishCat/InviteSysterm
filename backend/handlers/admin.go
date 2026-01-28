package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"invite-backend/database"
	"invite-backend/models"
	"invite-backend/services"
	"invite-backend/utils"

	"github.com/gin-gonic/gin"
)

// GetApplications 获取所有申请
func GetApplications(c *gin.Context) {
	status := c.Query("status")
	search := c.Query("search")

	query := "SELECT id, email, reason, status, device_id, ip, created_at, updated_at, admin_note FROM applications WHERE 1=1"
	var args []interface{}

	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}

	if search != "" {
		query += " AND (email LIKE ? OR reason LIKE ?)"
		args = append(args, "%"+search+"%", "%"+search+"%")
	}

	query += " ORDER BY created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	var apps []models.Application
	for rows.Next() {
		var app models.Application
		var createdAtVal, updatedAtVal interface{}
		var adminNote sql.NullString

		err := rows.Scan(
			&app.ID, &app.Email, &app.Reason, &app.Status,
			&app.DeviceID, &app.IP, &createdAtVal, &updatedAtVal, &adminNote,
		)
		if err != nil {
			continue
		}

		app.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
		app.UpdatedAt = time.Unix(database.ToUnixTimestamp(updatedAtVal), 0)
		if adminNote.Valid {
			app.AdminNote = adminNote.String
		}

		apps = append(apps, app)
	}

	c.JSON(http.StatusOK, apps)
}

// ReviewApplication 审核申请
func ReviewApplication(c *gin.Context) {
	var req struct {
		AppID  int    `json:"appId" binding:"required"`
		Status string `json:"status" binding:"required"`
		Data   struct {
			Code string `json:"code"`
			Note string `json:"note"`
		} `json:"data"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if req.Status != "approved" && req.Status != "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "状态值错误"})
		return
	}

	// 获取申请信息
	var email string
	err := database.DB.QueryRow("SELECT email FROM applications WHERE id = ?", req.AppID).Scan(&email)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "申请不存在"})
		return
	}

	// 开始事务
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	defer tx.Rollback()

	// 更新申请状态
	_, err = tx.Exec(
		"UPDATE applications SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?",
		req.Status, req.Data.Note, time.Now().Unix(), req.AppID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	// 如果批准，保存邀请码
	if req.Status == "approved" && req.Data.Code != "" {
		_, err = tx.Exec(
			"INSERT INTO invitation_codes (code, application_id, created_at) VALUES (?, ?, ?)",
			req.Data.Code, req.AppID, time.Now().Unix(),
		)
		if err != nil {
			// 如果已存在（可能是重复点击），则更新
			_, err = tx.Exec(
				"UPDATE invitation_codes SET code = ? WHERE application_id = ?",
				req.Data.Code, req.AppID,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存邀请码失败"})
				return
			}
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	// 发送邮件
	emailService, emailErr := services.GetEmailService()
	if emailErr == nil {
		if req.Status == "approved" {
			emailService.SendApprovalEmail(email, req.Data.Code, req.Data.Note)
		} else {
			emailService.SendRejectionEmail(email, req.Data.Note)
		}
	}

	// 记录审计日志
	adminID, _ := c.Get("admin_id")
	adminUsername, _ := c.Get("admin_username")
	_, _ = database.DB.Exec(
		"INSERT INTO audit_logs (admin_id, admin_username, action, application_id, target_email, details) VALUES (?, ?, ?, ?, ?, ?)",
		adminID, adminUsername, req.Status, req.AppID, email, req.Data.Note,
	)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "审核成功"})
}

// GetAuditLogs 获取审计日志
func GetAuditLogs(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT id, admin_id, admin_username, action, application_id, target_email, details, created_at 
		FROM audit_logs 
		ORDER BY created_at DESC 
		LIMIT 200
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	var logs []map[string]interface{}
	for rows.Next() {
		var id, adminID, appID int
		var adminUsername, action, targetEmail, details string
		var createdAtVal interface{}

		err := rows.Scan(&id, &adminID, &adminUsername, &action, &appID, &targetEmail, &details, &createdAtVal)
		if err != nil {
			continue
		}

		logs = append(logs, map[string]interface{}{
			"id":             id,
			"admin_id":       adminID,
			"admin_username": adminUsername,
			"action":         action,
			"application_id": appID,
			"target_email":   targetEmail,
			"details":        details,
			"created_at":     time.Unix(database.ToUnixTimestamp(createdAtVal), 0),
		})
	}

	c.JSON(http.StatusOK, logs)
}

// GetSettings 获取系统设置
func GetSettings(c *gin.Context) {
	settings, err := services.GetSystemSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateSettings 更新系统设置
func UpdateSettings(c *gin.Context) {
	var settings map[string]string
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 不允许通过此接口修改密码和用户名
	delete(settings, "admin_password_hash")
	delete(settings, "admin_username")

	err := services.UpdateSettings(settings)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "设置已更新"})
}

// GetAnnouncements 获取所有公告
func GetAnnouncements(c *gin.Context) {
	_, isAdmin := c.Get("admin_role")

	query := "SELECT id, content, is_active, created_at FROM announcements"
	if !isAdmin {
		query += " WHERE is_active = 1"
	}
	query += " ORDER BY created_at DESC"

	rows, err := database.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	announcements := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id int
		var content string
		var isActive int
		var createdAtVal interface{}
		if err := rows.Scan(&id, &content, &isActive, &createdAtVal); err != nil {
			continue
		}
		announcements = append(announcements, map[string]interface{}{
			"id":         id,
			"content":    content,
			"is_active":  isActive,
			"created_at": database.ToUnixTimestamp(createdAtVal),
		})
	}

	c.JSON(http.StatusOK, announcements)
}

// AddAnnouncement 添加公告
func AddAnnouncement(c *gin.Context) {
	var req struct {
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	now := time.Now().Unix()
	_, err := database.DB.Exec(
		"INSERT INTO announcements (content, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)",
		req.Content, 1, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "添加失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "公告已发布"})
}

// DeleteAnnouncement 删除公告
func DeleteAnnouncement(c *gin.Context) {
	id := c.Param("id")
	_, err := database.DB.Exec("DELETE FROM announcements WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "公告已删除"})
}

// ToggleAnnouncement 切换公告状态
func ToggleAnnouncement(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	isActive := 0
	if req.IsActive {
		isActive = 1
	}

	_, err := database.DB.Exec(
		"UPDATE announcements SET is_active = ?, updated_at = ? WHERE id = ?",
		isActive, time.Now().Unix(), id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "状态已更新"})
}

// GetAdmins 获取所有管理员
func GetAdmins(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, username, role, linuxdo_id, created_at, updated_at FROM admins ORDER BY created_at DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	admins := make([]models.Admin, 0)
	for rows.Next() {
		var admin models.Admin
		var createdAtVal, updatedAtVal interface{}
		var linuxdoID sql.NullString
		if err := rows.Scan(&admin.ID, &admin.Username, &admin.Role, &linuxdoID, &createdAtVal, &updatedAtVal); err != nil {
			continue
		}
		if linuxdoID.Valid {
			admin.LinuxDoID = linuxdoID.String
		}
		admin.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
		admin.UpdatedAt = time.Unix(database.ToUnixTimestamp(updatedAtVal), 0)
		admins = append(admins, admin)
	}

	c.JSON(http.StatusOK, admins)
}

// AddAdmin 添加管理员
func AddAdmin(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if req.Role != "super" && req.Role != "reviewer" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "角色无效"})
		return
	}

	passwordHash := utils.HashPassword(req.Password)
	now := time.Now().Unix()

	_, err := database.DB.Exec(
		"INSERT INTO admins (username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
		req.Username, passwordHash, req.Role, now, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "用户名已存在或添加失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "管理员已添加"})
}

// DeleteAdmin 删除管理员
func DeleteAdmin(c *gin.Context) {
	id := c.Param("id")
	currentAdminID, _ := c.Get("admin_id")

	// 不能删除自己
	if id == string(currentAdminID.(int)) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "不能删除自己"})
		return
	}

	// 检查是否是最后一个超级管理员
	var role string
	err := database.DB.QueryRow("SELECT role FROM admins WHERE id = ?", id).Scan(&role)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "管理员不存在"})
		return
	}

	if role == "super" {
		var superCount int
		database.DB.QueryRow("SELECT COUNT(*) FROM admins WHERE role = 'super'").Scan(&superCount)
		if superCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "必须保留至少一个超级管理员"})
			return
		}
	}

	_, err = database.DB.Exec("DELETE FROM admins WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "管理员已删除"})
}

// UpdateAdmin 更新管理员角色或密码
func UpdateAdmin(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Password string `json:"password"`
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	query := "UPDATE admins SET updated_at = ?"
	args := []interface{}{time.Now().Unix()}

	if req.Role != "" {
		if req.Role != "super" && req.Role != "reviewer" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "角色无效"})
			return
		}
		query += ", role = ?"
		args = append(args, req.Role)
	}

	if req.Password != "" {
		if len(req.Password) < 6 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "密码至少需要6个字符"})
			return
		}
		query += ", password_hash = ?"
		args = append(args, utils.HashPassword(req.Password))
	}

	query += " WHERE id = ?"
	args = append(args, id)

	_, err := database.DB.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "管理员信息已更新"})
}

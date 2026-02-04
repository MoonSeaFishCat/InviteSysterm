package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
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
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 基础查询
	baseQuery := `
		FROM applications a
		LEFT JOIN users u ON a.user_id = u.id
		LEFT JOIN admins ad ON a.processed_by = ad.id
		WHERE 1=1`
	var args []interface{}

	if status != "" {
		baseQuery += " AND a.status = ?"
		args = append(args, status)
	}

	if search != "" {
		baseQuery += " AND (a.email LIKE ? OR u.nickname LIKE ? OR a.reason LIKE ?)"
		args = append(args, "%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// 获取总数
	var total int
	err := database.DB.QueryRow("SELECT COUNT(*) "+baseQuery, args...).Scan(&total)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询总数失败"})
		return
	}

	// 获取分页数据
	query := `
		SELECT
			a.id, a.email, COALESCE(u.nickname, '') as user_nickname, a.reason, a.status, a.device_id, a.ip,
			a.created_at, a.updated_at, a.admin_note, a.review_opinion,
			a.processed_by, ad.username as admin_username,
			COALESCE(a.aigc_score, -1), COALESCE(a.aigc_confidence, ''), COALESCE(a.aigc_evidence, ''), COALESCE(a.aigc_analysis, ''),
			COALESCE(a.aigc_relevance, 0), COALESCE(a.aigc_authenticity, 0), COALESCE(a.aigc_completeness, 0), COALESCE(a.aigc_expression, 0), COALESCE(a.aigc_reply, '') ` + baseQuery + `
		ORDER BY a.created_at DESC
		LIMIT ? OFFSET ?`

	adminRole, _ := c.Get("admin_role")

	dataArgs := append(args, pageSize, (page-1)*pageSize)
	rows, err := database.DB.Query(query, dataArgs...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	var apps []models.Application
	for rows.Next() {
		var app models.Application
		var createdAtVal, updatedAtVal interface{}
		var adminNote, reviewOpinion, adminUsername sql.NullString
		var processedBy sql.NullInt64

		err := rows.Scan(
			&app.ID, &app.Email, &app.UserNickname, &app.Reason, &app.Status,
			&app.DeviceID, &app.IP, &createdAtVal, &updatedAtVal, &adminNote, &reviewOpinion,
			&processedBy, &adminUsername,
			&app.AigcScore, &app.AigcConfidence, &app.AigcEvidence, &app.AigcAnalysis,
			&app.AigcRelevance, &app.AigcAuthenticity, &app.AigcCompleteness, &app.AigcExpression, &app.AigcReply,
		)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}

		if adminRole != "super" {
			app.IP = ""
			app.DeviceID = ""
			// 隐藏邮箱
			app.Email = "********"
		}

		app.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
		app.UpdatedAt = time.Unix(database.ToUnixTimestamp(updatedAtVal), 0)
		if adminNote.Valid {
			app.AdminNote = adminNote.String
		}
		if reviewOpinion.Valid {
			app.ReviewOpinion = reviewOpinion.String
		}
		if processedBy.Valid {
			id := int(processedBy.Int64)
			app.ProcessedBy = &id
		}
		if adminUsername.Valid {
			app.AdminUsername = adminUsername.String
		}

		apps = append(apps, app)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"items":    apps,
	})
}

// GetApplicationDetail 获取申请详情（包括历史记录）
func GetApplicationDetail(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的申请ID"})
		return
	}

	// 获取当前管理员信息
	adminID, _ := c.Get("admin_id")
	adminName, _ := c.Get("admin_username")
	adminRole, _ := c.Get("admin_role")
	currentAdminID := adminID.(int)
	currentAdminName := adminName.(string)
	currentAdminRole := adminRole.(string)

	// 检查是否被其他管理员锁定
	lockManager := services.GetLockManager()
	isLocked, lock := lockManager.IsLocked(id, currentAdminID)

	// 超级管理员可以查看正在审核的申请（只读模式）
	isSuperAdmin := currentAdminRole == "super"
	isReadOnly := false
	var lockedByName string

	if isLocked {
		if isSuperAdmin {
			// 超级管理员可以查看，但是只读模式
			isReadOnly = true
			lockedByName = lock.AdminName
		} else {
			// 普通审核员被拦截
			c.JSON(http.StatusLocked, gin.H{
				"success":  false,
				"message":  fmt.Sprintf("该申请正在被 %s 审核中，请稍后再试", lock.AdminName),
				"locked":   true,
				"lockedBy": lock.AdminName,
			})
			return
		}
	}

	// 尝试锁定申请（超级管理员在只读模式下不锁定）
	if !isReadOnly {
		if !lockManager.LockApplication(id, currentAdminID, currentAdminName) {
			lock := lockManager.GetLock(id)
			if isSuperAdmin {
				// 超级管理员进入只读模式
				isReadOnly = true
				lockedByName = lock.AdminName
			} else {
				c.JSON(http.StatusLocked, gin.H{
					"success":  false,
					"message":  fmt.Sprintf("该申请正在被 %s 审核中，请稍后再试", lock.AdminName),
					"locked":   true,
					"lockedBy": lock.AdminName,
				})
				return
			}
		}
	}

	// 获取当前申请详情
	var app models.Application
	var createdAtVal, updatedAtVal any
	var adminNote, reviewOpinion, adminUsername sql.NullString
	var processedBy sql.NullInt64

	err = database.DB.QueryRow(`
		SELECT
			a.id, a.email, COALESCE(u.nickname, '') as user_nickname, a.reason, a.status, a.device_id, a.ip,
			a.created_at, a.updated_at, a.admin_note, a.review_opinion,
			a.processed_by, ad.username as admin_username,
			COALESCE(a.aigc_score, -1), COALESCE(a.aigc_confidence, ''), COALESCE(a.aigc_evidence, ''), COALESCE(a.aigc_analysis, ''),
			COALESCE(a.aigc_relevance, 0), COALESCE(a.aigc_authenticity, 0), COALESCE(a.aigc_completeness, 0), COALESCE(a.aigc_expression, 0), COALESCE(a.aigc_reply, '')
		FROM applications a
		LEFT JOIN users u ON a.user_id = u.id
		LEFT JOIN admins ad ON a.processed_by = ad.id
		WHERE a.id = ?
	`, id).Scan(
		&app.ID, &app.Email, &app.UserNickname, &app.Reason, &app.Status,
		&app.DeviceID, &app.IP, &createdAtVal, &updatedAtVal, &adminNote, &reviewOpinion,
		&processedBy, &adminUsername,
		&app.AigcScore, &app.AigcConfidence, &app.AigcEvidence, &app.AigcAnalysis,
		&app.AigcRelevance, &app.AigcAuthenticity, &app.AigcCompleteness, &app.AigcExpression, &app.AigcReply,
	)

	if err != nil {
		// 解锁（只读模式不需要解锁）
		if !isReadOnly {
			lockManager.UnlockApplication(id, currentAdminID)
		}
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "申请不存在"})
		return
	}

	if currentAdminRole != "super" {
		app.IP = ""
		app.DeviceID = ""
		// 隐藏邮箱
		app.Email = "********"
	}

	app.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
	app.UpdatedAt = time.Unix(database.ToUnixTimestamp(updatedAtVal), 0)
	if adminNote.Valid {
		app.AdminNote = adminNote.String
	}
	if reviewOpinion.Valid {
		app.ReviewOpinion = reviewOpinion.String
	}
	if processedBy.Valid {
		pID := int(processedBy.Int64)
		app.ProcessedBy = &pID
	}
	if adminUsername.Valid {
		app.AdminUsername = adminUsername.String
	}

	// 获取同一邮箱或设备的历史申请记录
	historyQuery := `
		SELECT
			a.id, a.email, COALESCE(u.nickname, '') as user_nickname, a.reason, a.status, a.device_id, a.ip,
			a.created_at, a.updated_at, a.admin_note, a.review_opinion,
			a.processed_by, ad.username as admin_username
		FROM applications a
		LEFT JOIN users u ON a.user_id = u.id
		LEFT JOIN admins ad ON a.processed_by = ad.id
		WHERE (a.email = ? OR a.device_id = ?) AND a.id != ?
		ORDER BY a.created_at DESC
	`

	rows, err := database.DB.Query(historyQuery, app.Email, app.DeviceID, app.ID)
	if err != nil {
		// 如果查询历史失败，仍然返回当前申请信息
		c.JSON(http.StatusOK, gin.H{
			"success":     true,
			"application": app,
			"history":     []models.Application{},
			"readOnly":    isReadOnly,
			"lockedBy":    lockedByName,
		})
		return
	}
	defer rows.Close()

	var history []models.Application
	for rows.Next() {
		var histApp models.Application
		var hCreatedAtVal, hUpdatedAtVal any
		var hAdminNote, hReviewOpinion, hAdminUsername sql.NullString
		var hProcessedBy sql.NullInt64

		err = rows.Scan(
			&histApp.ID, &histApp.Email, &histApp.UserNickname, &histApp.Reason, &histApp.Status,
			&histApp.DeviceID, &histApp.IP, &hCreatedAtVal, &hUpdatedAtVal, &hAdminNote, &hReviewOpinion,
			&hProcessedBy, &hAdminUsername,
		)
		if err != nil {
			continue
		}

		if currentAdminRole != "super" {
			histApp.IP = ""
			histApp.DeviceID = ""
			// 隐藏邮箱
			histApp.Email = "********"
		}

		histApp.CreatedAt = time.Unix(database.ToUnixTimestamp(hCreatedAtVal), 0)
		histApp.UpdatedAt = time.Unix(database.ToUnixTimestamp(hUpdatedAtVal), 0)
		if hAdminNote.Valid {
			histApp.AdminNote = hAdminNote.String
		}
		if hReviewOpinion.Valid {
			histApp.ReviewOpinion = hReviewOpinion.String
		}
		if hProcessedBy.Valid {
			hPID := int(hProcessedBy.Int64)
			histApp.ProcessedBy = &hPID
		}
		if hAdminUsername.Valid {
			histApp.AdminUsername = hAdminUsername.String
		}

		history = append(history, histApp)
	}

	// 获取申请的投票信息
	rows, err = database.DB.Query(`
		SELECT id, voter_id, voter_username, opinion, comment, created_at
		FROM application_votes
		WHERE application_id = ?
		ORDER BY created_at DESC
	`, id)
	var votes []models.ApplicationVote
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var v models.ApplicationVote
			var vComment sql.NullString
			var vCreatedAt int64
			if err := rows.Scan(&v.ID, &v.VoterID, &v.VoterUsername, &v.Opinion, &vComment, &vCreatedAt); err != nil {
				continue
			}
			if vComment.Valid {
				v.Comment = vComment.String
			}
			v.CreatedAt = time.Unix(vCreatedAt, 0)
			v.ApplicationID = id
			votes = append(votes, v)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"application": app,
		"history":     history,
		"votes":       votes,
		"readOnly":    isReadOnly,
		"lockedBy":    lockedByName,
	})
}

// ReviewApplication 审核申请
func ReviewApplication(c *gin.Context) {
	var req struct {
		AppID  int    `json:"appId" binding:"required"`
		Status string `json:"status" binding:"required"`
		Data   struct {
			Code    string `json:"code"`
			Note    string `json:"note"`
			Opinion string `json:"opinion"`
		} `json:"data"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 获取当前管理员信息
	adminID, _ := c.Get("admin_id")
	adminRole, _ := c.Get("admin_role")
	currentAdminID := adminID.(int)
	currentAdminRole := adminRole.(string)

	if currentAdminRole == "commenter" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "评论员无权审核申请，只能投票"})
		return
	}

	// 检查锁定状态
	lockManager := services.GetLockManager()
	isLocked, lock := lockManager.IsLocked(req.AppID, currentAdminID)
	if isLocked {
		c.JSON(http.StatusLocked, gin.H{
			"success": false,
			"message": fmt.Sprintf("该申请正在被 %s 审核中，无法提交", lock.AdminName),
		})
		return
	}

	if req.Status != "approved" && req.Status != "rejected" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "状态值错误"})
		return
	}

	// 获取申请信息（包括用户ID，用于发送站内信）
	var email string
	var userID sql.NullInt64
	err := database.DB.QueryRow("SELECT email, user_id FROM applications WHERE id = ?", req.AppID).Scan(&email, &userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "申请不存在"})
		return
	}

	// 记录审计日志
	adminUsername, _ := c.Get("admin_username")
	auditDetails := req.Data.Note
	if req.Data.Opinion != "" {
		if auditDetails != "" {
			auditDetails += " | 意见: " + req.Data.Opinion
		} else {
			auditDetails = "意见: " + req.Data.Opinion
		}
	}

	// 开始事务
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	defer tx.Rollback()

	// 获取管理员 ID（复用之前的变量）
	adminIDForUpdate := adminID

	// 更新申请状态
	_, err = tx.Exec(
		"UPDATE applications SET status = ?, admin_note = ?, review_opinion = ?, processed_by = ?, updated_at = ? WHERE id = ?",
		req.Status, req.Data.Note, req.Data.Opinion, adminIDForUpdate, time.Now().Unix(), req.AppID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	// 更新管理员审核统计
	_, err = tx.Exec(
		"UPDATE admins SET audit_count = audit_count + 1, last_audit_at = ?, updated_at = ? WHERE id = ?",
		time.Now().Unix(), time.Now().Unix(), adminIDForUpdate,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新管理员统计失败"})
		return
	}

	// 记录审计日志（移动到事务内）
	_, err = tx.Exec(
		"INSERT INTO audit_logs (admin_id, admin_username, action, application_id, target_email, details) VALUES (?, ?, ?, ?, ?, ?)",
		adminID, adminUsername, req.Status, req.AppID, email, auditDetails,
	)
	if err != nil {
		log.Printf("Failed to insert audit log: %v", err)
		// 即使日志记录失败，也不一定回滚审核操作，但最好记录下来
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	// 审核完成后解锁
	lockManager.UnlockApplication(req.AppID, currentAdminID)

	// 异步发送邮件，避免阻塞审核响应
	go func(status, targetEmail, code, opinion string) {
		emailService, emailErr := services.GetEmailService()
		if emailErr == nil {
			if status == "approved" {
				// 注意：此处 code 仅通过邮件发送，不存入数据库
				emailService.SendApprovalEmail(targetEmail, code, opinion)
			} else {
				emailService.SendRejectionEmail(targetEmail, opinion)
			}
		}
	}(req.Status, email, req.Data.Code, req.Data.Opinion)

	// 发送站内信通知（如果用户已注册）
	if userID.Valid {
		go func(uid int, status, opinion string) {
			if status == "approved" {
				_ = SendMessageToUser(uid, "🎉 您的邀请码申请已通过", "恭喜！您的邀请码申请已通过审核，邀请码已发送至您的邮箱，请查收。")
			} else {
				rejectMsg := "很抱歉，您的邀请码申请未通过审核。"
				if opinion != "" {
					rejectMsg += "\n\n审核意见：" + opinion
				}
				_ = SendMessageToUser(uid, "关于您的邀请码申请", rejectMsg)
			}
		}(int(userID.Int64), req.Status, req.Data.Opinion)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "处理成功"})
}

// DeleteApplication 删除申请
func DeleteApplication(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的申请ID"})
		return
	}

	// 开始事务
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	defer tx.Rollback()

	// 1. 删除关联的邀请码（如果有）
	_, err = tx.Exec("DELETE FROM invitation_codes WHERE application_id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除关联邀请码失败"})
		return
	}

	// 2. 删除申请记录
	res, err := tx.Exec("DELETE FROM applications WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除申请失败"})
		return
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "申请不存在"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "删除成功"})
}

// AdminBatchReviewApplications 批量审核申请
func AdminBatchReviewApplications(c *gin.Context) {
	var req struct {
		AppIDs []int  `json:"appIds" binding:"required"`
		Status string `json:"status" binding:"required"`
		Data   struct {
			Opinion string `json:"opinion"`
			Note    string `json:"note"`
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

	adminID, _ := c.Get("admin_id")
	adminUsername, _ := c.Get("admin_username")

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	defer tx.Rollback()

	now := time.Now().Unix()
	emailService, _ := services.GetEmailService()

	processedCount := 0
	for _, appID := range req.AppIDs {
		var email string
		err := tx.QueryRow("SELECT email FROM applications WHERE id = ?", appID).Scan(&email)
		if err != nil {
			continue
		}

		// 更新申请状态
		_, err = tx.Exec(
			"UPDATE applications SET status = ?, admin_note = ?, review_opinion = ?, processed_by = ?, updated_at = ? WHERE id = ?",
			req.Status, req.Data.Note, req.Data.Opinion, adminID, now, appID,
		)
		if err != nil {
			continue
		}
		processedCount++

		// 记录日志
		tx.Exec(
			"INSERT INTO audit_logs (admin_id, admin_username, action, application_id, target_email, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
			adminID, adminUsername, "batch_"+req.Status, appID, email, fmt.Sprintf("批量审核: %s", req.Status), now,
		)

		// 异步发送邮件
		if emailService != nil {
			if req.Status == "approved" {
				// 批量审核通过时，如果需要自动生成邀请码，这里需要逻辑。
				// 目前先只发送通知，或者要求前端提供邀请码（批量生成邀请码较复杂，通常建议批量审核为拒绝，通过则逐个处理以分配码）
				// 简化逻辑：如果是批量通过，我们只更新状态，不自动生成邀请码，除非系统支持。
				go emailService.SendApprovalEmail(email, "请联系管理员获取", req.Data.Opinion)
			} else {
				go emailService.SendRejectionEmail(email, req.Data.Opinion)
			}
		}
	}

	// 更新管理员审核统计
	if processedCount > 0 {
		_, _ = tx.Exec(
			"UPDATE admins SET audit_count = audit_count + ?, last_audit_at = ?, updated_at = ? WHERE id = ?",
			processedCount, now, now, adminID,
		)
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "批量处理完成"})
}

// AdminBatchDeleteApplications 批量删除申请
func AdminBatchDeleteApplications(c *gin.Context) {
	var req struct {
		AppIDs []int `json:"appIds" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	defer tx.Rollback()

	for _, appID := range req.AppIDs {
		tx.Exec("DELETE FROM invitation_codes WHERE application_id = ?", appID)
		tx.Exec("DELETE FROM applications WHERE id = ?", appID)
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "批量删除成功"})
}

// AdminGetStats 获取管理员统计数据
func AdminGetStats(c *gin.Context) {
	var stats struct {
		PendingApps   int `json:"pending_apps"`
		ApprovedApps  int `json:"approved_apps"`
		RejectedApps  int `json:"rejected_apps"`
		TotalApps     int `json:"total_apps"`
		OpenTickets   int `json:"open_tickets"`
		TotalTickets  int `json:"total_tickets"`
		TotalUsers    int `json:"total_users"`
		TotalMessages int `json:"total_messages"`
		TotalAdmins   int `json:"total_admins"`
	}

	// 查询申请统计
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status = 'pending'").Scan(&stats.PendingApps); err != nil {
		log.Printf("Failed to query pending apps: %v", err)
	}
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status = 'approved'").Scan(&stats.ApprovedApps); err != nil {
		log.Printf("Failed to query approved apps: %v", err)
	}
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM applications WHERE status = 'rejected'").Scan(&stats.RejectedApps); err != nil {
		log.Printf("Failed to query rejected apps: %v", err)
	}
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM applications").Scan(&stats.TotalApps); err != nil {
		log.Printf("Failed to query total apps: %v", err)
	}

	// 查询工单统计
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM tickets WHERE status = 'open'").Scan(&stats.OpenTickets); err != nil {
		log.Printf("Failed to query open tickets: %v", err)
	}
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM tickets").Scan(&stats.TotalTickets); err != nil {
		log.Printf("Failed to query total tickets: %v", err)
	}

	// 查询用户统计
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&stats.TotalUsers); err != nil {
		log.Printf("Failed to query total users: %v", err)
	}

	// 查询消息统计
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM messages").Scan(&stats.TotalMessages); err != nil {
		log.Printf("Failed to query total messages: %v", err)
	}

	// 查询管理员统计
	if err := database.DB.QueryRow("SELECT COUNT(*) FROM admins").Scan(&stats.TotalAdmins); err != nil {
		log.Printf("Failed to query total admins: %v", err)
		stats.TotalAdmins = 0
	}

	c.JSON(http.StatusOK, stats)
}

// AdminGetUsers 管理员获取用户列表
func AdminGetUsers(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, email, nickname, status, created_at FROM users ORDER BY created_at DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id int
		var email, nickname, status string
		var createdAt int64
		if err := rows.Scan(&id, &email, &nickname, &status, &createdAt); err != nil {
			continue
		}
		users = append(users, map[string]interface{}{
			"id":         id,
			"email":      email,
			"nickname":   nickname,
			"status":     status,
			"created_at": createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": users})
}

// AnalyzeApplicationAIGC 分析申请理由的 AIGC 可能性
func AnalyzeApplicationAIGC(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的申请ID"})
		return
	}

	// 获取申请内容
	var reason string
	err = database.DB.QueryRow("SELECT reason FROM applications WHERE id = ?", id).Scan(&reason)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "申请不存在"})
		return
	}

	// 调用 AI 分析服务
	result, err := services.AnalyzeAIGC(reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "AI 分析失败: " + err.Error()})
		return
	}

	// 更新数据库
	_, err = database.DB.Exec(`
		UPDATE applications 
		SET aigc_score = ?, aigc_confidence = ?, aigc_evidence = ?, aigc_analysis = ?, 
		    aigc_relevance = ?, aigc_authenticity = ?, aigc_completeness = ?, aigc_expression = ?, aigc_reply = ?,
		    updated_at = ?
		WHERE id = ?
	`, result.Score, result.Confidence, result.Evidence, result.Analysis,
		result.Relevance, result.Authenticity, result.Completeness, result.Expression, result.Reply,
		time.Now().Unix(), id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新分析结果失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "分析完成",
		"data":    result,
	})
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
		var id int
		var adminID, appID sql.NullInt64
		var adminUsername, action, targetEmail, details sql.NullString
		var createdAtVal interface{}

		err := rows.Scan(&id, &adminID, &adminUsername, &action, &appID, &targetEmail, &details, &createdAtVal)
		if err != nil {
			log.Printf("Error scanning audit log row: %v", err)
			continue
		}

		logs = append(logs, map[string]interface{}{
			"id":             id,
			"admin_id":       adminID.Int64,
			"admin_username": adminUsername.String,
			"action":         action.String,
			"application_id": appID.Int64,
			"target_email":   targetEmail.String,
			"details":        details.String,
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
	rows, err := database.DB.Query("SELECT id, username, role, permissions, linuxdo_id, created_at, updated_at FROM admins ORDER BY created_at DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	admins := make([]models.Admin, 0)
	for rows.Next() {
		var admin models.Admin
		var createdAtVal, updatedAtVal interface{}
		var linuxdoID, permissions sql.NullString
		if err := rows.Scan(&admin.ID, &admin.Username, &admin.Role, &permissions, &linuxdoID, &createdAtVal, &updatedAtVal); err != nil {
			continue
		}
		if linuxdoID.Valid {
			admin.LinuxDoID = linuxdoID.String
		}
		if permissions.Valid {
			admin.Permissions = permissions.String
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
		Username    string `json:"username" binding:"required"`
		Password    string `json:"password" binding:"required"`
		Role        string `json:"role" binding:"required"`
		Permissions string `json:"permissions"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)

	if req.Role != "super" && req.Role != "reviewer" && req.Role != "commenter" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "角色无效"})
		return
	}

	// 检查是否允许新增审核员/评论员
	if req.Role == "reviewer" || req.Role == "commenter" {
		settings, _ := services.GetSystemSettings()
		if settings["allow_auto_admin_reg"] == "false" {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "系统已关闭新增管理员功能"})
			return
		}

		// 如果没有指定权限，使用默认权限
		if req.Permissions == "" {
			if req.Role == "reviewer" {
				req.Permissions = settings["default_reviewer_permissions"]
				if req.Permissions == "" {
					req.Permissions = "applications,tickets,messages"
				}
			} else {
				// 评论员默认权限较少
				req.Permissions = "overview,ranking,chat"
			}
		}
	} else if req.Role == "super" {
		// 超级管理员拥有所有权限
		req.Permissions = "all"
	}

	passwordHash := utils.HashPassword(req.Password)
	now := time.Now().Unix()

	_, err := database.DB.Exec(
		"INSERT INTO admins (username, password_hash, role, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		req.Username, passwordHash, req.Role, req.Permissions, now, now,
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
	if id == strconv.Itoa(currentAdminID.(int)) {
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
		Password    string `json:"password"`
		Role        string `json:"role"`
		Permissions string `json:"permissions"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	req.Password = strings.TrimSpace(req.Password)

	query := "UPDATE admins SET updated_at = ?"
	args := []interface{}{time.Now().Unix()}

	if req.Role != "" {
		if req.Role != "super" && req.Role != "reviewer" && req.Role != "commenter" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "角色无效"})
			return
		}
		query += ", role = ?"
		args = append(args, req.Role)
	}

	if req.Permissions != "" || req.Role == "super" {
		// 超级管理员默认拥有所有权限，或者手动更新权限
		query += ", permissions = ?"
		if req.Role == "super" {
			args = append(args, "all")
		} else {
			args = append(args, req.Permissions)
		}
	} else if (req.Role == "reviewer" || req.Role == "commenter") && req.Permissions == "" {
		// 如果切换回审核员/评论员且没传权限，设为默认
		query += ", permissions = ?"
		if req.Role == "reviewer" {
			settings, _ := services.GetSystemSettings()
			perms := settings["default_reviewer_permissions"]
			if perms == "" {
				perms = "applications,tickets,messages"
			}
			args = append(args, perms)
		} else {
			args = append(args, "overview,ranking,chat")
		}
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

// GetAuditorKPI 获取审核员 KPI 统计
func GetAuditorKPI(c *gin.Context) {
	adminID, _ := c.Get("admin_id")
	role, _ := c.Get("admin_role")

	if role != "reviewer" && role != "super" {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权访问"})
		return
	}

	// 如果是超管，可以查询特定审核员，否则只能查自己
	targetID := adminID.(int)
	if role == "super" {
		if idStr := c.Query("id"); idStr != "" {
			if id, err := strconv.Atoi(idStr); err == nil {
				targetID = id
			}
		}
	}

	// 获取指标设置
	var quotaStr string
	_ = database.DB.QueryRow("SELECT value FROM settings WHERE key = 'weekly_audit_quota'").Scan(&quotaStr)
	quota, _ := strconv.Atoi(quotaStr)

	sevenDaysAgo := time.Now().AddDate(0, 0, -7).Unix()

	// 统计过去7天审核量 (仅包含直接处理)
	var count int
	_ = database.DB.QueryRow(`
		SELECT COUNT(*) FROM applications 
		WHERE processed_by = ? AND updated_at >= ? AND status IN ('approved', 'rejected')
	`, targetID, sevenDaysAgo).Scan(&count)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"quota": quota,
			"count": count,
			"remaining": func() int {
				if quota-count < 0 {
					return 0
				}
				return quota - count
			}(),
			"is_met": count >= quota,
		},
	})
}

// BatchUpdateAdminPermissions 批量更新管理员权限
func BatchUpdateAdminPermissions(c *gin.Context) {
	var req struct {
		AdminIDs    []int  `json:"adminIds" binding:"required"`
		Permissions string `json:"permissions" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if len(req.AdminIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请选择至少一个管理员"})
		return
	}

	// 获取当前管理员ID，防止修改自己的权限
	currentAdminID, _ := c.Get("admin_id")

	// 开始事务
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	defer tx.Rollback()

	now := time.Now().Unix()
	successCount := 0
	skippedCount := 0

	for _, adminID := range req.AdminIDs {
		// 不能修改自己的权限
		if adminID == currentAdminID.(int) {
			skippedCount++
			continue
		}

		// 检查是否是超级管理员（超级管理员权限不能通过批量修改）
		var role string
		err := tx.QueryRow("SELECT role FROM admins WHERE id = ?", adminID).Scan(&role)
		if err != nil {
			skippedCount++
			continue
		}

		if role == "super" {
			skippedCount++
			continue
		}

		// 更新权限
		_, err = tx.Exec(
			"UPDATE admins SET permissions = ?, updated_at = ? WHERE id = ?",
			req.Permissions, now, adminID,
		)
		if err != nil {
			skippedCount++
			continue
		}

		successCount++
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	message := fmt.Sprintf("成功更新 %d 个管理员权限", successCount)
	if skippedCount > 0 {
		message += fmt.Sprintf("，跳过 %d 个（超级管理员或自己）", skippedCount)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"message":      message,
		"successCount": successCount,
		"skippedCount": skippedCount,
	})
}

// ==================== 用户管理 ====================

// GetAllUsers 获取所有用户
func GetAllUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	status := c.Query("status")
	search := c.Query("search")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 构建查询
	baseQuery := "FROM users WHERE 1=1"
	var args []interface{}

	if status != "" {
		baseQuery += " AND status = ?"
		args = append(args, status)
	}

	if search != "" {
		baseQuery += " AND (email LIKE ? OR nickname LIKE ?)"
		args = append(args, "%"+search+"%", "%"+search+"%")
	}

	// 获取总数
	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	database.DB.QueryRow(countQuery, args...).Scan(&total)

	// 获取列表
	offset := (page - 1) * pageSize
	query := "SELECT id, email, nickname, status, created_at, updated_at " + baseQuery + " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, pageSize, offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询失败"})
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id int
		var email, nickname, status string
		var createdAt, updatedAt int64
		if err := rows.Scan(&id, &email, &nickname, &status, &createdAt, &updatedAt); err != nil {
			continue
		}
		users = append(users, map[string]interface{}{
			"id":         id,
			"email":      email,
			"nickname":   nickname,
			"status":     status,
			"created_at": createdAt,
			"updated_at": updatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"data":     users,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GetUserDetail 获取用户详情
func GetUserDetail(c *gin.Context) {
	id := c.Param("id")

	var user struct {
		ID        int    `json:"id"`
		Email     string `json:"email"`
		Nickname  string `json:"nickname"`
		Status    string `json:"status"`
		CreatedAt int64  `json:"created_at"`
		UpdatedAt int64  `json:"updated_at"`
	}

	err := database.DB.QueryRow(
		"SELECT id, email, nickname, status, created_at, updated_at FROM users WHERE id = ?",
		id,
	).Scan(&user.ID, &user.Email, &user.Nickname, &user.Status, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "用户不存在"})
		return
	}

	// 获取用户的申请记录
	rows, err := database.DB.Query(
		"SELECT id, email, reason, status, device_id, ip, created_at FROM applications WHERE user_id = ? ORDER BY created_at DESC",
		id,
	)
	if err == nil {
		defer rows.Close()
		var applications []map[string]interface{}
		for rows.Next() {
			var appID int
			var email, reason, status, deviceID, ip string
			var createdAt int64
			if err := rows.Scan(&appID, &email, &reason, &status, &deviceID, &ip, &createdAt); err == nil {
				applications = append(applications, map[string]interface{}{
					"id":         appID,
					"email":      email,
					"reason":     reason,
					"status":     status,
					"device_id":  deviceID,
					"ip":         ip,
					"created_at": createdAt,
				})
			}
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "user": user, "applications": applications})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "user": user})
}

// UpdateUserStatus 更新用户状态
func UpdateUserStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if req.Status != "active" && req.Status != "banned" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "状态值无效"})
		return
	}

	_, err := database.DB.Exec(
		"UPDATE users SET status = ?, updated_at = ? WHERE id = ?",
		req.Status, time.Now().Unix(), id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "用户状态已更新"})
}

// DeleteUser 删除用户
func DeleteUser(c *gin.Context) {
	id := c.Param("id")

	// 检查用户是否存在
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM users WHERE id = ?", id).Scan(&count)
	if count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "用户不存在"})
		return
	}

	// 删除用户
	_, err := database.DB.Exec("DELETE FROM users WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "用户已删除"})
}

// ResetUserPassword 重置用户密码
func ResetUserPassword(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		NewPassword string `json:"newPassword" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "密码至少6个字符"})
		return
	}

	req.NewPassword = strings.TrimSpace(req.NewPassword)

	passwordHash := utils.HashPassword(req.NewPassword)
	_, err := database.DB.Exec(
		"UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
		passwordHash, time.Now().Unix(), id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "重置失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "密码已重置"})
}

// ==================== 黑名单管理 ====================

// GetBlacklist 获取黑名单列表
func GetBlacklist(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	blacklistType := c.Query("type")
	search := c.Query("search")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 构建查询
	baseQuery := "FROM blacklist WHERE 1=1"
	var args []interface{}

	if blacklistType != "" {
		baseQuery += " AND type = ?"
		args = append(args, blacklistType)
	}

	if search != "" {
		baseQuery += " AND (value LIKE ? OR reason LIKE ?)"
		args = append(args, "%"+search+"%", "%"+search+"%")
	}

	// 获取总数
	var total int
	countQuery := "SELECT COUNT(*) " + baseQuery
	database.DB.QueryRow(countQuery, args...).Scan(&total)

	// 获取列表
	offset := (page - 1) * pageSize
	query := "SELECT id, type, value, reason, created_by, created_by_username, created_at, updated_at " + baseQuery + " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, pageSize, offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询失败"})
		return
	}
	defer rows.Close()

	var blacklist []map[string]interface{}
	for rows.Next() {
		var id, createdBy int
		var blacklistType, value, reason, createdByUsername string
		var createdAt, updatedAt int64
		if err := rows.Scan(&id, &blacklistType, &value, &reason, &createdBy, &createdByUsername, &createdAt, &updatedAt); err != nil {
			continue
		}
		blacklist = append(blacklist, map[string]interface{}{
			"id":                  id,
			"type":                blacklistType,
			"value":               value,
			"reason":              reason,
			"created_by":          createdBy,
			"created_by_username": createdByUsername,
			"created_at":          createdAt,
			"updated_at":          updatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"data":     blacklist,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// AddBlacklist 添加黑名单
func AddBlacklist(c *gin.Context) {
	var req struct {
		Type   string `json:"type" binding:"required"`
		Value  string `json:"value" binding:"required"`
		Reason string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 验证类型
	if req.Type != "email" && req.Type != "device" && req.Type != "ip" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "类型必须是 email, device 或 ip"})
		return
	}

	// 获取当前管理员信息
	adminID, _ := c.Get("admin_id")
	adminUsername, _ := c.Get("admin_username")

	// 检查是否已存在
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM blacklist WHERE type = ? AND value = ?", req.Type, req.Value).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该项已在黑名单中"})
		return
	}

	// 添加到黑名单
	_, err := database.DB.Exec(
		"INSERT INTO blacklist (type, value, reason, created_by, created_by_username, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		req.Type, req.Value, req.Reason, adminID, adminUsername, time.Now().Unix(), time.Now().Unix(),
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "添加失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已添加到黑名单"})
}

// UpdateBlacklist 更新黑名单
func UpdateBlacklist(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Reason string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	_, err := database.DB.Exec(
		"UPDATE blacklist SET reason = ?, updated_at = ? WHERE id = ?",
		req.Reason, time.Now().Unix(), id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "黑名单已更新"})
}

// DeleteBlacklist 删除黑名单
func DeleteBlacklist(c *gin.Context) {
	id := c.Param("id")

	_, err := database.DB.Exec("DELETE FROM blacklist WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已从黑名单移除"})
}

// AdminBatchDeleteAdmins 批量删除管理员
func AdminBatchDeleteAdmins(c *gin.Context) {
	var req struct {
		AdminIDs []int `json:"adminIds" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	currentAdminID, _ := c.Get("admin_id")
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	defer tx.Rollback()

	successCount := 0
	skippedCount := 0

	for _, id := range req.AdminIDs {
		// 不能删除自己
		if id == currentAdminID.(int) {
			skippedCount++
			continue
		}

		// 检查是否是超级管理员
		var role string
		err := tx.QueryRow("SELECT role FROM admins WHERE id = ?", id).Scan(&role)
		if err != nil {
			skippedCount++
			continue
		}

		if role == "super" {
			var superCount int
			tx.QueryRow("SELECT COUNT(*) FROM admins WHERE role = 'super'").Scan(&superCount)
			if superCount <= 1 {
				skippedCount++
				continue
			}
		}

		_, err = tx.Exec("DELETE FROM admins WHERE id = ?", id)
		if err != nil {
			skippedCount++
			continue
		}
		successCount++
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("成功删除 %d 个管理员，跳过 %d 个", successCount, skippedCount),
	})
}

// AdminBatchDeleteUsers 批量删除用户
func AdminBatchDeleteUsers(c *gin.Context) {
	var req struct {
		UserIDs []int `json:"userIds" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	defer tx.Rollback()

	for _, id := range req.UserIDs {
		tx.Exec("DELETE FROM users WHERE id = ?", id)
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "批量删除用户成功"})
}

// AdminBatchUpdateUserStatus 批量更新用户状态
func AdminBatchUpdateUserStatus(c *gin.Context) {
	var req struct {
		UserIDs []int  `json:"userIds" binding:"required"`
		Status  string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if req.Status != "active" && req.Status != "banned" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "状态值无效"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "系统错误"})
		return
	}
	defer tx.Rollback()

	now := time.Now().Unix()
	for _, id := range req.UserIDs {
		tx.Exec("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", req.Status, now, id)
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "批量更新用户状态成功"})
}

// CheckBlacklist 检查是否在黑名单中（内部使用）
func CheckBlacklist(blacklistType, value string) bool {
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM blacklist WHERE type = ? AND value = ?", blacklistType, value).Scan(&count)
	return count > 0
}

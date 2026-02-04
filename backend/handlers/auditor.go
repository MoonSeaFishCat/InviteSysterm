package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"invite-backend/database"
	"invite-backend/models"
	"invite-backend/services"

	"github.com/gin-gonic/gin"
)

// VoteOnApplication 投票申请
func VoteOnApplication(c *gin.Context) {
	appIDStr := c.Param("id")
	appID, _ := strconv.Atoi(appIDStr)

	var req struct {
		Opinion string `json:"opinion" binding:"required"` // agree, reject
		Comment string `json:"comment"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	adminID, _ := c.Get("admin_id")
	adminUsername, _ := c.Get("admin_username")

	// 检查是否已经投票过
	var count int
	database.DB.QueryRow("SELECT COUNT(*) FROM application_votes WHERE application_id = ? AND voter_id = ?", appID, adminID).Scan(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "您已经投过票了"})
		return
	}

	_, err := database.DB.Exec(
		"INSERT INTO application_votes (application_id, voter_id, voter_username, opinion, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		appID, adminID, adminUsername, req.Opinion, req.Comment, time.Now().Unix(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "投票失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "投票成功"})
}

// GetApplicationVotes 获取申请的投票情况
func GetApplicationVotes(c *gin.Context) {
	appIDStr := c.Param("id")
	appID, _ := strconv.Atoi(appIDStr)

	rows, err := database.DB.Query(`
		SELECT id, voter_id, voter_username, opinion, comment, created_at
		FROM application_votes
		WHERE application_id = ?
		ORDER BY created_at ASC
	`, appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取投票失败"})
		return
	}
	defer rows.Close()

	votes := make([]models.ApplicationVote, 0)
	for rows.Next() {
		var vote models.ApplicationVote
		var createdAtVal interface{}
		var comment sql.NullString
		if err := rows.Scan(&vote.ID, &vote.VoterID, &vote.VoterUsername, &vote.Opinion, &comment, &createdAtVal); err != nil {
			continue
		}
		if comment.Valid {
			vote.Comment = comment.String
		}
		vote.ApplicationID = appID
		vote.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
		votes = append(votes, vote)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": votes})
}

// GetAuditorRanking 获取审核员排行
func GetAuditorRanking(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT 
			a.id, 
			a.username, 
			a.role, 
			(SELECT COUNT(*) FROM applications WHERE processed_by = a.id AND status IN ('approved', 'rejected')) as total_audit_count,
			(SELECT MAX(updated_at) FROM applications WHERE processed_by = a.id AND status IN ('approved', 'rejected')) as last_audit_at,
			a.created_at,
			a.updated_at
		FROM admins a
		WHERE a.role IN ('super', 'reviewer')
		ORDER BY total_audit_count DESC
		LIMIT 20
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取排行失败"})
		return
	}
	defer rows.Close()

	type RankingItem struct {
		ID          int        `json:"id"`
		Username    string     `json:"username"`
		Role        string     `json:"role"`
		AuditCount  int        `json:"auditCount"`
		LastAuditAt *time.Time `json:"lastAuditAt"`
		CreatedAt   time.Time  `json:"createdAt"`
		UpdatedAt   time.Time  `json:"updatedAt"`
	}

	ranking := make([]RankingItem, 0)
	for rows.Next() {
		var item RankingItem
		var lastAuditVal, createdAtVal, updatedAtVal interface{}
		if err := rows.Scan(&item.ID, &item.Username, &item.Role, &item.AuditCount, &lastAuditVal, &createdAtVal, &updatedAtVal); err != nil {
			continue
		}
		if lastAuditVal != nil {
			t := time.Unix(database.ToUnixTimestamp(lastAuditVal), 0)
			item.LastAuditAt = &t
		}
		item.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
		item.UpdatedAt = time.Unix(database.ToUnixTimestamp(updatedAtVal), 0)
		ranking = append(ranking, item)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": ranking})
}

// ProcessAuditorApplication 处理审核员申请 (超管)
func ProcessAuditorApplication(c *gin.Context) {
	var req struct {
		ID     int    `json:"id" binding:"required"`
		Status string `json:"status" binding:"required"` // approved, rejected
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	processorID, _ := c.Get("admin_id")

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "事务开始失败"})
		return
	}
	defer tx.Rollback()

	var adminID int
	err = tx.QueryRow("SELECT admin_id FROM auditor_applications WHERE id = ? AND status = 'pending'", req.ID).Scan(&adminID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "申请不存在或已处理"})
		return
	}

	_, err = tx.Exec(
		"UPDATE auditor_applications SET status = ?, processed_by = ? WHERE id = ?",
		req.Status, processorID, req.ID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新申请状态失败"})
		return
	}

	if req.Status == "approved" {
		_, err = tx.Exec("UPDATE admins SET role = 'reviewer' WHERE id = ? AND role NOT IN ('super', 'reviewer')", adminID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新管理员角色失败"})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "处理成功"})
}

// ApplyForAuditor 申请成为审核员
func ApplyForAuditor(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	adminID, _ := c.Get("admin_id")
	adminRole, _ := c.Get("admin_role")

	if adminRole.(string) != "commenter" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "只有评论员可以申请成为审核员"})
		return
	}

	// 检查是否开启免审核模式
	settings, _ := services.GetSystemSettings()
	noReview := settings["auditor_no_review"] == "true"

	if !noReview && req.Reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "申请理由不能为空"})
		return
	}

	// 检查是否已有处理中的申请
	var count int
	err := database.DB.QueryRow("SELECT COUNT(*) FROM auditor_applications WHERE admin_id = ? AND status = 'pending'", adminID).Scan(&count)
	if err == nil && count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "您已有正在处理中的申请"})
		return
	}

	if noReview {
		// 免审核模式下，如果理由为空，设置默认理由
		if req.Reason == "" {
			req.Reason = "免审核模式自动申请"
		}
		tx, err := database.DB.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "事务开始失败"})
			return
		}
		defer tx.Rollback()

		// 直接插入已通过的申请
		_, err = tx.Exec(
			"INSERT INTO auditor_applications (admin_id, reason, status, created_at, processed_by) VALUES (?, ?, 'approved', ?, ?)",
			adminID, req.Reason, time.Now().Unix(), adminID, // 自动通过，processed_by 可以是自己或留空，这里设为自己表示自审
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交申请失败"})
			return
		}

		// 直接提升角色 (仅当原角色不是 super 或 reviewer 时)
		_, err = tx.Exec("UPDATE admins SET role = 'reviewer' WHERE id = ? AND role NOT IN ('super', 'reviewer')", adminID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "角色提升失败"})
			return
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "申请已通过（免审核模式）"})
		return
	}

	_, err = database.DB.Exec(
		"INSERT INTO auditor_applications (admin_id, reason, status, created_at) VALUES (?, ?, 'pending', ?)",
		adminID, req.Reason, time.Now().Unix(),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交申请失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "申请已提交，请等待超管审核"})
}

// GetAuditorApplications 获取审核员申请列表 (超管)
func GetAuditorApplications(c *gin.Context) {
	status := c.Query("status")
	query := "SELECT aa.id, aa.admin_id, a.username, aa.reason, aa.status, aa.created_at FROM auditor_applications aa JOIN admins a ON aa.admin_id = a.id"
	var args []interface{}

	if status != "" {
		query += " WHERE aa.status = ?"
		args = append(args, status)
	}
	query += " ORDER BY aa.created_at DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取列表失败"})
		return
	}
	defer rows.Close()

	applications := make([]models.AuditorApplication, 0)
	for rows.Next() {
		var app models.AuditorApplication
		var createdAtVal interface{}
		if err := rows.Scan(&app.ID, &app.AdminID, &app.AdminUsername, &app.Reason, &app.Status, &createdAtVal); err != nil {
			continue
		}
		app.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
		applications = append(applications, app)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": applications})
}

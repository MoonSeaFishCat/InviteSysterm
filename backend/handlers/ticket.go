package handlers

import (
	"net/http"
	"time"

	"invite-backend/database"

	"github.com/gin-gonic/gin"
)

// CreateTicket 创建工单
func CreateTicket(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req struct {
		Subject string `json:"subject" binding:"required"`
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}

	now := time.Now().Unix()
	res, err := tx.Exec(
		"INSERT INTO tickets (user_id, subject, status, created_at, updated_at) VALUES (?, ?, 'open', ?, ?)",
		userID, req.Subject, now, now,
	)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建失败"})
		return
	}

	ticketID, _ := res.LastInsertId()

	_, err = tx.Exec(
		"INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, content, created_at) VALUES (?, 'user', ?, ?, ?)",
		ticketID, userID, req.Content, now,
	)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "消息保存失败"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "工单已提交", "id": ticketID})
}

// GetUserTickets 获取用户的工单列表
func GetUserTickets(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rows, err := database.DB.Query(
		"SELECT id, subject, status, created_at, updated_at FROM tickets WHERE user_id = ? ORDER BY updated_at DESC",
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}
	defer rows.Close()

	var tickets []map[string]interface{}
	for rows.Next() {
		var id int
		var subject, status string
		var createdAt, updatedAt int64
		if err := rows.Scan(&id, &subject, &status, &createdAt, &updatedAt); err != nil {
			continue
		}
		tickets = append(tickets, map[string]interface{}{
			"id":         id,
			"subject":    subject,
			"status":     status,
			"created_at": createdAt,
			"updated_at": updatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": tickets})
}

// GetTicketMessages 获取工单消息详情
func GetTicketMessages(c *gin.Context) {
	ticketID := c.Param("id")

	// 权限检查：要么是工单持有者，要么是管理员
	userID, userExists := c.Get("user_id")
	_, adminExists := c.Get("admin_id")

	if !userExists && !adminExists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未授权"})
		return
	}

	if userExists {
		var ownerID int
		err := database.DB.QueryRow("SELECT user_id FROM tickets WHERE id = ?", ticketID).Scan(&ownerID)
		if err != nil || ownerID != userID.(int) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权访问"})
			return
		}
	}
	// 如果是 adminExists，则直接通过，管理员有权查看所有工单

	rows, err := database.DB.Query(
		"SELECT id, sender_type, sender_id, content, created_at FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC",
		ticketID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}
	defer rows.Close()

	var messages []map[string]interface{}
	for rows.Next() {
		var id, senderID int
		var senderType, content string
		var createdAt int64
		if err := rows.Scan(&id, &senderType, &senderID, &content, &createdAt); err != nil {
			continue
		}
		messages = append(messages, map[string]interface{}{
			"id":          id,
			"sender_type": senderType,
			"sender_id":   senderID,
			"content":     content,
			"created_at":  createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": messages})
}

// ReplyTicket 回复工单
func ReplyTicket(c *gin.Context) {
	ticketID := c.Param("id")
	userID, _ := c.Get("user_id")

	var req struct {
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 校验归属权
	var ownerID int
	err := database.DB.QueryRow("SELECT user_id FROM tickets WHERE id = ?", ticketID).Scan(&ownerID)
	if err != nil || ownerID != userID.(int) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权操作"})
		return
	}

	now := time.Now().Unix()
	_, err = database.DB.Exec(
		"INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, content, created_at) VALUES (?, 'user', ?, ?, ?)",
		ticketID, userID, req.Content, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "回复失败"})
		return
	}

	// 更新工单状态为 open
	_, _ = database.DB.Exec("UPDATE tickets SET status = 'open', updated_at = ? WHERE id = ?", now, ticketID)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "回复成功"})
}

// AdminGetTickets 管理员获取工单列表
func AdminGetTickets(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT t.id, t.user_id, u.email, u.nickname, t.subject, t.status, t.created_at, t.updated_at 
		FROM tickets t
		JOIN users u ON t.user_id = u.id
		ORDER BY t.updated_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}
	defer rows.Close()

	var tickets []map[string]interface{}
	for rows.Next() {
		var id, userID int
		var email, nickname, subject, status string
		var createdAt, updatedAt int64
		if err := rows.Scan(&id, &userID, &email, &nickname, &subject, &status, &createdAt, &updatedAt); err != nil {
			continue
		}
		tickets = append(tickets, map[string]interface{}{
			"id":         id,
			"user_id":    userID,
			"email":      email,
			"nickname":   nickname,
			"subject":    subject,
			"status":     status,
			"created_at": createdAt,
			"updated_at": updatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": tickets})
}

// AdminReplyTicket 管理员回复工单
func AdminReplyTicket(c *gin.Context) {
	ticketID := c.Param("id")
	adminID, _ := c.Get("admin_id")

	var req struct {
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}

	now := time.Now().Unix()
	_, err = tx.Exec(
		"INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, content, created_at) VALUES (?, 'admin', ?, ?, ?)",
		ticketID, adminID, req.Content, now,
	)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "回复失败"})
		return
	}

	// 更新工单状态为 replied
	_, err = tx.Exec("UPDATE tickets SET status = 'replied', updated_at = ? WHERE id = ?", now, ticketID)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "状态更新失败"})
		return
	}

	tx.Commit()

	// 尝试给用户发送站内信通知
	var userID int
	var subject string
	_ = database.DB.QueryRow("SELECT user_id, subject FROM tickets WHERE id = ?", ticketID).Scan(&userID, &subject)
	_ = SendMessageToUser(userID, "您的工单有了新回复", "您关于 '"+subject+"' 的工单已被管理员回复，请前往工单系统查看。")

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "回复成功"})
}

// AdminCloseTicket 管理员关闭工单
func AdminCloseTicket(c *gin.Context) {
	ticketID := c.Param("id")
	now := time.Now().Unix()

	_, err := database.DB.Exec("UPDATE tickets SET status = 'closed', updated_at = ? WHERE id = ?", now, ticketID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "操作失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "工单已关闭"})
}

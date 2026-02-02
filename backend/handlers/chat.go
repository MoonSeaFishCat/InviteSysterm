package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"invite-backend/database"
	"invite-backend/models"

	"github.com/gin-gonic/gin"
)

// scanChatMessage 扫描聊天消息行的辅助函数
func scanChatMessage(rows *sql.Rows) (models.ChatMessage, error) {
	var msg models.ChatMessage
	var createdAtVal interface{}
	var isPinned, isFeatured int
	var quoteID, receiverID sql.NullInt64
	var receiverType sql.NullString

	err := rows.Scan(
		&msg.ID, &msg.SenderID, &msg.SenderUsername, &msg.SenderRole, &msg.SenderType,
		&msg.Content, &quoteID, &isPinned, &isFeatured, &createdAtVal, &receiverID, &receiverType,
	)
	if err != nil {
		return msg, err
	}

	msg.IsPinned = isPinned == 1
	msg.IsFeatured = isFeatured == 1
	if quoteID.Valid {
		id := int(quoteID.Int64)
		msg.QuoteID = &id
		_ = database.DB.QueryRow("SELECT content FROM chat_messages WHERE id = ?", id).Scan(&msg.QuoteContent)
	}
	if receiverID.Valid {
		id := int(receiverID.Int64)
		msg.ReceiverID = &id
	}
	if receiverType.Valid {
		msg.ReceiverType = receiverType.String
	}
	msg.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
	return msg, nil
}

// GetGlobalChatMessages 获取全局聊天消息
func GetGlobalChatMessages(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT id, sender_id, sender_username, sender_role, sender_type, content, quote_id, is_pinned, is_featured, created_at, receiver_id, receiver_type
		FROM chat_messages
		WHERE is_private = 0
		ORDER BY is_pinned DESC, created_at DESC
		LIMIT 100
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取消息失败"})
		return
	}
	defer rows.Close()

	var messages = make([]models.ChatMessage, 0)
	for rows.Next() {
		msg, err := scanChatMessage(rows)
		if err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	// 反转消息顺序，让最新的在下面（除了置顶的）
	pinned := make([]models.ChatMessage, 0)
	normal := make([]models.ChatMessage, 0)
	for _, m := range messages {
		if m.IsPinned {
			pinned = append(pinned, m)
		} else {
			normal = append(normal, m)
		}
	}
	for i, j := 0, len(normal)-1; i < j; i, j = i+1, j-1 {
		normal[i], normal[j] = normal[j], normal[i]
	}

	result := append(pinned, normal...)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

// SendGlobalChatMessage 发送全局聊天消息
func SendGlobalChatMessage(c *gin.Context) {
	var req struct {
		Content string `json:"message" binding:"required"` // 适配前端字段名
		QuoteID *int   `json:"quote_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	senderID, _ := c.Get("admin_id")
	senderUsername, _ := c.Get("admin_username")
	senderRole, _ := c.Get("admin_role")

	now := time.Now().Unix()
	res, err := database.DB.Exec(
		"INSERT INTO chat_messages (sender_id, sender_username, sender_role, sender_type, content, quote_id, is_private, created_at) VALUES (?, ?, ?, 'admin', ?, ?, 0, ?)",
		senderID, senderUsername, senderRole, req.Content, req.QuoteID, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "发送失败"})
		return
	}

	id, _ := res.LastInsertId()

	// 返回完整对象
	var msg models.ChatMessage
	msg.ID = int(id)
	msg.SenderID = senderID.(int)
	msg.SenderUsername = senderUsername.(string)
	msg.SenderRole = senderRole.(string)
	msg.SenderType = "admin"
	msg.Content = req.Content
	msg.QuoteID = req.QuoteID
	if req.QuoteID != nil {
		_ = database.DB.QueryRow("SELECT content FROM chat_messages WHERE id = ?", *req.QuoteID).Scan(&msg.QuoteContent)
	}
	msg.CreatedAt = time.Unix(now, 0)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": msg})
}

// UserGetAdmins 用户获取可选的私信管理员列表 (仅超管和审核员)
func UserGetAdmins(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, username, role FROM admins WHERE role IN ('super', 'reviewer') ORDER BY role ASC, id ASC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取管理员列表失败"})
		return
	}
	defer rows.Close()

	var admins []map[string]interface{}
	for rows.Next() {
		var id int
		var username, role string
		if err := rows.Scan(&id, &username, &role); err != nil {
			continue
		}
		admins = append(admins, map[string]interface{}{
			"id":       id,
			"username": username,
			"role":     role,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": admins})
}

// GetPrivateMessages 获取私信 (管理员侧)
func GetPrivateMessages(c *gin.Context) {
	adminID, _ := c.Get("admin_id")
	receiverIDStr := c.Query("receiver_id")
	receiverType := c.Query("receiver_type")

	query := `
		SELECT id, sender_id, sender_username, sender_role, sender_type, content, quote_id, is_pinned, is_featured, created_at, receiver_id, receiver_type
		FROM chat_messages
		WHERE is_private = 1 AND (
			(sender_id = ? AND sender_type = 'admin') OR 
			(receiver_id = ? AND receiver_type = 'admin')
		)
	`
	args := []interface{}{adminID, adminID}

	if receiverIDStr != "" {
		receiverID, _ := strconv.Atoi(receiverIDStr)
		if receiverType == "" {
			receiverType = "admin" // 默认管理员
		}
		query += ` AND (
			(sender_id = ? AND sender_type = ? AND receiver_id = ? AND receiver_type = 'admin') OR
			(sender_id = ? AND sender_type = 'admin' AND receiver_id = ? AND receiver_type = ?)
		)`
		args = append(args, receiverID, receiverType, adminID, adminID, receiverID, receiverType)
	}

	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取私信失败"})
		return
	}
	defer rows.Close()

	var messages = make([]models.ChatMessage, 0)
	for rows.Next() {
		msg, err := scanChatMessage(rows)
		if err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	// 反转消息顺序，让最新的在下面
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": messages})
}

// SendPrivateMessage 发送私信 (管理员侧)
func SendPrivateMessage(c *gin.Context) {
	var req struct {
		ReceiverID   int    `json:"receiver_id" binding:"required"`
		ReceiverType string `json:"receiver_type"` // admin, user
		Content      string `json:"message" binding:"required"`
		QuoteID      *int   `json:"quote_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 如果没有提供 receiver_type，默认为 user (因为待回复私信列表主要是针对用户的)
	if req.ReceiverType == "" {
		req.ReceiverType = "user"
	}

	senderID, _ := c.Get("admin_id")
	senderUsername, _ := c.Get("admin_username")
	senderRole, _ := c.Get("admin_role")

	now := time.Now().Unix()
	res, err := database.DB.Exec(
		"INSERT INTO chat_messages (sender_id, sender_username, sender_role, sender_type, content, quote_id, is_private, receiver_id, receiver_type, created_at) VALUES (?, ?, ?, 'admin', ?, ?, 1, ?, ?, ?)",
		senderID, senderUsername, senderRole, req.Content, req.QuoteID, req.ReceiverID, req.ReceiverType, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "发送失败"})
		return
	}

	id, _ := res.LastInsertId()

	// 返回完整对象
	var msg models.ChatMessage
	msg.ID = int(id)
	msg.SenderID = senderID.(int)
	msg.SenderUsername = senderUsername.(string)
	msg.SenderRole = senderRole.(string)
	msg.SenderType = "admin"
	msg.Content = req.Content
	msg.QuoteID = req.QuoteID
	if req.QuoteID != nil {
		_ = database.DB.QueryRow("SELECT content FROM chat_messages WHERE id = ?", *req.QuoteID).Scan(&msg.QuoteContent)
	}
	msg.IsPrivate = true
	msg.ReceiverID = &req.ReceiverID
	msg.ReceiverType = req.ReceiverType
	msg.CreatedAt = time.Unix(now, 0)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": msg})
}

// UserGetPrivateMessages 用户获取与管理员的私信
func UserGetPrivateMessages(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rows, err := database.DB.Query(`
		SELECT id, sender_id, sender_username, sender_role, sender_type, content, quote_id, is_pinned, is_featured, created_at, receiver_id, receiver_type
		FROM chat_messages
		WHERE is_private = 1 AND ((sender_id = ? AND sender_type = 'user') OR (receiver_id = ? AND receiver_type = 'user'))
		ORDER BY created_at DESC
		LIMIT 100
	`, userID, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取私信失败"})
		return
	}
	defer rows.Close()

	var messages []models.ChatMessage
	for rows.Next() {
		msg, err := scanChatMessage(rows)
		if err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	// 反转消息顺序
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": messages})
}

// UserSendGlobalChatMessage 用户发送全局聊天消息
func UserSendGlobalChatMessage(c *gin.Context) {
	var req struct {
		Content string `json:"message" binding:"required"`
		QuoteID *int   `json:"quote_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	userID, _ := c.Get("user_id")
	userEmail, _ := c.Get("user_email")

	now := time.Now().Unix()
	res, err := database.DB.Exec(
		"INSERT INTO chat_messages (sender_id, sender_username, sender_role, sender_type, content, quote_id, is_private, created_at) VALUES (?, ?, 'user', 'user', ?, ?, 0, ?)",
		userID, userEmail, req.Content, req.QuoteID, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "发送失败"})
		return
	}

	id, _ := res.LastInsertId()

	// 返回完整对象
	var msg models.ChatMessage
	msg.ID = int(id)
	msg.SenderID = userID.(int)
	msg.SenderUsername = userEmail.(string)
	msg.SenderRole = "user"
	msg.SenderType = "user"
	msg.Content = req.Content
	msg.QuoteID = req.QuoteID
	if req.QuoteID != nil {
		_ = database.DB.QueryRow("SELECT content FROM chat_messages WHERE id = ?", *req.QuoteID).Scan(&msg.QuoteContent)
	}
	msg.CreatedAt = time.Unix(now, 0)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": msg})
}

// UserSendPrivateMessage 用户发送私信给管理员
func UserSendPrivateMessage(c *gin.Context) {
	var req struct {
		ReceiverID int    `json:"receiver_id"`                // 使其可选
		Content    string `json:"message" binding:"required"` // 统一使用 message
		QuoteID    *int   `json:"quote_id"`                   // 统一使用 quote_id
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	userID, _ := c.Get("user_id")
	userEmail, _ := c.Get("user_email")

	// 如果没有指定接收者，默认发送给第一个超级管理员
	if req.ReceiverID == 0 {
		err := database.DB.QueryRow("SELECT id FROM admins WHERE role = 'super' ORDER BY id ASC LIMIT 1").Scan(&req.ReceiverID)
		if err != nil {
			// 如果没有超管，尝试找任何管理员
			err = database.DB.QueryRow("SELECT id FROM admins ORDER BY id ASC LIMIT 1").Scan(&req.ReceiverID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "暂无可用管理员"})
				return
			}
		}
	} else {
		// 检查接收者是否是有效的管理员
		var exists int
		database.DB.QueryRow("SELECT COUNT(*) FROM admins WHERE id = ?", req.ReceiverID).Scan(&exists)
		if exists == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "目标管理员不存在"})
			return
		}
	}

	now := time.Now().Unix()
	res, err := database.DB.Exec(
		"INSERT INTO chat_messages (sender_id, sender_username, sender_role, sender_type, content, quote_id, is_private, receiver_id, receiver_type, created_at) VALUES (?, ?, 'user', 'user', ?, ?, 1, ?, 'admin', ?)",
		userID, userEmail, req.Content, req.QuoteID, req.ReceiverID, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "发送失败"})
		return
	}

	id, _ := res.LastInsertId()

	// 返回完整对象
	var msg models.ChatMessage
	msg.ID = int(id)
	msg.SenderID = userID.(int)
	msg.SenderUsername = userEmail.(string)
	msg.SenderRole = "user"
	msg.SenderType = "user"
	msg.Content = req.Content
	msg.QuoteID = req.QuoteID
	if req.QuoteID != nil {
		_ = database.DB.QueryRow("SELECT content FROM chat_messages WHERE id = ?", *req.QuoteID).Scan(&msg.QuoteContent)
	}
	msg.IsPrivate = true
	msg.ReceiverID = &req.ReceiverID
	msg.ReceiverType = "admin"
	msg.CreatedAt = time.Unix(now, 0)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": msg})
}

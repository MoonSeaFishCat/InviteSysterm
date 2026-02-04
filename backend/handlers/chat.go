package handlers

import (
	"database/sql"
	"net/http"
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
	var receiverType, roomVal sql.NullString

	err := rows.Scan(
		&msg.ID, &msg.SenderID, &msg.SenderUsername, &msg.SenderRole, &msg.SenderType,
		&msg.Content, &quoteID, &isPinned, &isFeatured, &createdAtVal, &receiverID, &receiverType, &roomVal,
	)
	if err != nil {
		return msg, err
	}

	msg.IsPinned = isPinned == 1
	msg.IsFeatured = isFeatured == 1
	if quoteID.Valid {
		id := int(quoteID.Int64)
		msg.QuoteID = &id
		_ = database.DB.QueryRow("SELECT content, sender_username FROM chat_messages WHERE id = ?", id).Scan(&msg.QuoteContent, &msg.QuoteUsername)
	}
	if receiverID.Valid {
		id := int(receiverID.Int64)
		msg.ReceiverID = &id
	}
	if receiverType.Valid {
		msg.ReceiverType = receiverType.String
	}
	if roomVal.Valid {
		msg.Room = roomVal.String
	}
	msg.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0)
	return msg, nil
}

// GetGlobalChatMessages 获取全局聊天消息
func GetGlobalChatMessages(c *gin.Context) {
	room := c.DefaultQuery("room", "global")
	var rows *sql.Rows
	var err error

	if room == "audit" {
		// 检查权限，只有管理员能看审核团队频道
		_, exists := c.Get("admin_id")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权访问审核团队频道"})
			return
		}
		rows, err = database.DB.Query(`
			SELECT id, sender_id, sender_username, sender_role, sender_type, content, quote_id, is_pinned, is_featured, created_at, receiver_id, receiver_type, room
			FROM chat_messages
			WHERE is_private = 0 AND room = 'audit'
			ORDER BY is_pinned DESC, created_at DESC
			LIMIT 100
		`)
	} else {
		rows, err = database.DB.Query(`
			SELECT id, sender_id, sender_username, sender_role, sender_type, content, quote_id, is_pinned, is_featured, created_at, receiver_id, receiver_type, room
			FROM chat_messages
			WHERE is_private = 0 AND (room = 'global' OR room IS NULL OR room = '')
			ORDER BY is_pinned DESC, created_at DESC
			LIMIT 100
		`)
	}

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
		Room    string `json:"room"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if req.Room == "" {
		req.Room = "global"
	}

	senderID, _ := c.Get("admin_id")
	senderUsername, _ := c.Get("admin_username")
	senderRole, _ := c.Get("admin_role")

	now := time.Now().Unix()
	res, err := database.DB.Exec(
		"INSERT INTO chat_messages (sender_id, sender_username, sender_role, sender_type, content, quote_id, is_private, created_at, room) VALUES (?, ?, ?, 'admin', ?, ?, 0, ?, ?)",
		senderID, senderUsername, senderRole, req.Content, req.QuoteID, now, req.Room,
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
	msg.Room = req.Room
	if req.QuoteID != nil {
		_ = database.DB.QueryRow("SELECT content FROM chat_messages WHERE id = ?", *req.QuoteID).Scan(&msg.QuoteContent)
	}
	msg.CreatedAt = time.Unix(now, 0)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": msg})
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
		"INSERT INTO chat_messages (sender_id, sender_username, sender_role, sender_type, content, quote_id, is_private, created_at, room) VALUES (?, ?, 'user', 'user', ?, ?, 0, ?, 'global')",
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

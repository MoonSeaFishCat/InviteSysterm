package handlers

import (
	"net/http"
	"time"

	"invite-backend/database"

	"github.com/gin-gonic/gin"
)

// AdminChatMessage 管理员聊天消息
type AdminChatMessage struct {
	ID            int    `json:"id"`
	AdminID       int    `json:"adminId"`
	AdminUsername string `json:"adminUsername"`
	AdminRole     string `json:"adminRole"`
	Message       string `json:"message"`
	IsPinned      bool   `json:"isPinned"`
	IsFeatured    bool   `json:"isFeatured"`
	CreatedAt     string `json:"createdAt"`
}

// GetAdminChatMessages 获取管理员聊天消息
func GetAdminChatMessages(c *gin.Context) {
	// 获取最近100条消息，置顶消息优先
	rows, err := database.DB.Query(`
		SELECT id, admin_id, admin_username, admin_role, message, is_pinned, is_featured, created_at
		FROM admin_chat_messages
		ORDER BY is_pinned DESC, created_at DESC
		LIMIT 100
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取消息失败"})
		return
	}
	defer rows.Close()

	messages := make([]AdminChatMessage, 0)
	for rows.Next() {
		var msg AdminChatMessage
		var createdAtVal interface{}
		var isPinned, isFeatured int
		if err := rows.Scan(&msg.ID, &msg.AdminID, &msg.AdminUsername, &msg.AdminRole, &msg.Message, &isPinned, &isFeatured, &createdAtVal); err != nil {
			continue
		}
		msg.IsPinned = isPinned == 1
		msg.IsFeatured = isFeatured == 1
		msg.CreatedAt = time.Unix(database.ToUnixTimestamp(createdAtVal), 0).Format("2006-01-02 15:04:05")
		messages = append(messages, msg)
	}

	// 反转顺序，让最新的消息在最后（但置顶消息保持在前）
	// 分离置顶和非置顶消息
	pinnedMessages := make([]AdminChatMessage, 0)
	normalMessages := make([]AdminChatMessage, 0)
	for _, msg := range messages {
		if msg.IsPinned {
			pinnedMessages = append(pinnedMessages, msg)
		} else {
			normalMessages = append(normalMessages, msg)
		}
	}

	// 反转非置顶消息
	for i, j := 0, len(normalMessages)-1; i < j; i, j = i+1, j-1 {
		normalMessages[i], normalMessages[j] = normalMessages[j], normalMessages[i]
	}

	// 合并：置顶消息在前，普通消息在后
	result := append(pinnedMessages, normalMessages...)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

// SendAdminChatMessage 发送管理员聊天消息
func SendAdminChatMessage(c *gin.Context) {
	var req struct {
		Message string `json:"message" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	if len(req.Message) == 0 || len(req.Message) > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "消息长度必须在1-1000字符之间"})
		return
	}

	adminID, _ := c.Get("admin_id")
	adminUsername, _ := c.Get("admin_username")
	adminRole, _ := c.Get("admin_role")

	now := time.Now().Unix()
	result, err := database.DB.Exec(
		"INSERT INTO admin_chat_messages (admin_id, admin_username, admin_role, message, created_at) VALUES (?, ?, ?, ?, ?)",
		adminID, adminUsername, adminRole, req.Message, now,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "发送消息失败"})
		return
	}

	msgID, _ := result.LastInsertId()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "发送成功",
		"data": AdminChatMessage{
			ID:            int(msgID),
			AdminID:       adminID.(int),
			AdminUsername: adminUsername.(string),
			AdminRole:     adminRole.(string),
			Message:       req.Message,
			IsPinned:      false,
			IsFeatured:    false,
			CreatedAt:     time.Unix(now, 0).Format("2006-01-02 15:04:05"),
		},
	})
}

// DeleteAdminChatMessage 删除管理员聊天消息（仅超级管理员）
func DeleteAdminChatMessage(c *gin.Context) {
	msgID := c.Param("id")

	_, err := database.DB.Exec("DELETE FROM admin_chat_messages WHERE id = ?", msgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "删除成功"})
}

// PinAdminChatMessage 置顶管理员聊天消息（仅超级管理员）
func PinAdminChatMessage(c *gin.Context) {
	msgID := c.Param("id")

	_, err := database.DB.Exec("UPDATE admin_chat_messages SET is_pinned = 1 WHERE id = ?", msgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "置顶失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "置顶成功"})
}

// UnpinAdminChatMessage 取消置顶管理员聊天消息（仅超级管理员）
func UnpinAdminChatMessage(c *gin.Context) {
	msgID := c.Param("id")

	_, err := database.DB.Exec("UPDATE admin_chat_messages SET is_pinned = 0 WHERE id = ?", msgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "取消置顶失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "取消置顶成功"})
}

// FeatureAdminChatMessage 加精管理员聊天消息（仅超级管理员）
func FeatureAdminChatMessage(c *gin.Context) {
	msgID := c.Param("id")

	_, err := database.DB.Exec("UPDATE admin_chat_messages SET is_featured = 1 WHERE id = ?", msgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "加精失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "加精成功"})
}

// UnfeatureAdminChatMessage 取消加精管理员聊天消息（仅超级管理员）
func UnfeatureAdminChatMessage(c *gin.Context) {
	msgID := c.Param("id")

	_, err := database.DB.Exec("UPDATE admin_chat_messages SET is_featured = 0 WHERE id = ?", msgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "取消加精失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "取消加精成功"})
}

package handlers

import (
	"net/http"
	"time"

	"invite-backend/database"

	"github.com/gin-gonic/gin"
)

// GetUserMessages 获取用户的站内信列表
func GetUserMessages(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rows, err := database.DB.Query(
		"SELECT id, title, content, is_read, created_at FROM messages WHERE user_id = ? ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}
	defer rows.Close()

	var messages []map[string]interface{}
	for rows.Next() {
		var id int
		var title, content string
		var isRead int
		var createdAt int64
		if err := rows.Scan(&id, &title, &content, &isRead, &createdAt); err != nil {
			continue
		}
		messages = append(messages, map[string]interface{}{
			"id":         id,
			"title":      title,
			"content":    content,
			"is_read":    isRead == 1,
			"created_at": createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": messages})
}

// ReadMessage 标记站内信为已读
func ReadMessage(c *gin.Context) {
	messageID := c.Param("id")
	userID, _ := c.Get("user_id")

	_, err := database.DB.Exec(
		"UPDATE messages SET is_read = 1 WHERE id = ? AND user_id = ?",
		messageID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已标记为已读"})
}

// ReadAllMessages 全部标记为已读
func ReadAllMessages(c *gin.Context) {
	userID, _ := c.Get("user_id")

	_, err := database.DB.Exec(
		"UPDATE messages SET is_read = 1 WHERE user_id = ?",
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "全部标记为已读"})
}

// AdminSendMessage 管理员发送站内信接口
func AdminSendMessage(c *gin.Context) {
	var req struct {
		UserID  int    `json:"user_id" binding:"required"`
		Title   string `json:"title" binding:"required"`
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	err := SendMessageToUser(req.UserID, req.Title, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "发送失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已发送"})
}

// SendMessageToUser 给用户发送站内信 (内部函数)
func SendMessageToUser(userID int, title, content string) error {
	now := time.Now().Unix()
	_, err := database.DB.Exec(
		"INSERT INTO messages (user_id, title, content, is_read, created_at) VALUES (?, ?, ?, 0, ?)",
		userID, title, content, now,
	)
	return err
}

// AdminBatchSendMessage 管理员批量发送站内信
func AdminBatchSendMessage(c *gin.Context) {
	var req struct {
		UserIDs   []int  `json:"user_ids"`
		SendToAll bool   `json:"send_to_all"`
		Title     string `json:"title" binding:"required"`
		Content   string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	now := time.Now().Unix()

	if req.SendToAll {
		_, err := database.DB.Exec(
			"INSERT INTO messages (user_id, title, content, is_read, created_at) SELECT id, ?, ?, 0, ? FROM users",
			req.Title, req.Content, now,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "发送失败"})
			return
		}
	} else if len(req.UserIDs) > 0 {
		tx, err := database.DB.Begin()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
			return
		}
		defer tx.Rollback()

		stmt, err := tx.Prepare("INSERT INTO messages (user_id, title, content, is_read, created_at) VALUES (?, ?, ?, 0, ?)")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "准备语句失败"})
			return
		}
		defer stmt.Close()

		for _, userID := range req.UserIDs {
			_, err := stmt.Exec(userID, req.Title, req.Content, now)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "部分消息发送失败"})
				return
			}
		}

		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交事务失败"})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请选择接收用户"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "批量发送成功"})
}

// AdminGetAllMessages 获取所有已发送的站内信记录
func AdminGetAllMessages(c *gin.Context) {
	rows, err := database.DB.Query(
		`SELECT m.id, m.user_id, u.email, u.nickname, m.title, m.content, m.is_read, m.created_at 
		 FROM messages m 
		 JOIN users u ON m.user_id = u.id 
		 ORDER BY m.created_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库错误"})
		return
	}
	defer rows.Close()

	var messages []map[string]interface{}
	for rows.Next() {
		var id, userID int
		var email, nickname, title, content string
		var isRead int
		var createdAt int64
		if err := rows.Scan(&id, &userID, &email, &nickname, &title, &content, &isRead, &createdAt); err != nil {
			continue
		}
		messages = append(messages, map[string]interface{}{
			"id":         id,
			"user_id":    userID,
			"email":      email,
			"nickname":   nickname,
			"title":      title,
			"content":    content,
			"is_read":    isRead == 1,
			"created_at": createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": messages})
}

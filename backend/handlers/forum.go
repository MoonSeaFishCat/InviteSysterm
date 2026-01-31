package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"invite-backend/database"

	"github.com/gin-gonic/gin"
)

// GetForumPosts 获取所有帖子（公开，无需认证）
func GetForumPosts(c *gin.Context) {
	// 获取分页参数
	page := 1
	pageSize := 20
	if p := c.Query("page"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if ps := c.Query("page_size"); ps != "" {
		if parsed, err := strconv.Atoi(ps); err == nil && parsed > 0 && parsed <= 100 {
			pageSize = parsed
		}
	}
	offset := (page - 1) * pageSize

	// 获取总数
	var total int
	err := database.DB.QueryRow("SELECT COUNT(*) FROM forum_posts").Scan(&total)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询失败"})
		return
	}

	rows, err := database.DB.Query(`
		SELECT
			fp.id, fp.title, fp.content, fp.is_pinned, fp.created_at, fp.updated_at,
			COALESCE(u.nickname, u.email) as author_name,
			COALESCE(a.username, '') as admin_author_name,
			(SELECT COUNT(*) FROM forum_replies WHERE post_id = fp.id) as reply_count
		FROM forum_posts fp
		LEFT JOIN users u ON fp.user_id = u.id
		LEFT JOIN admins a ON fp.admin_id = a.id
		ORDER BY fp.is_pinned DESC, fp.created_at DESC
		LIMIT ? OFFSET ?
	`, pageSize, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询失败"})
		return
	}
	defer rows.Close()

	var posts []map[string]interface{}
	for rows.Next() {
		var id, isPinned int
		var title, content, authorName, adminAuthorName string
		var createdAt, updatedAt int64
		var replyCount int

		err := rows.Scan(&id, &title, &content, &isPinned, &createdAt, &updatedAt, &authorName, &adminAuthorName, &replyCount)
		if err != nil {
			continue
		}

		author := authorName
		isAdmin := false
		if adminAuthorName != "" {
			author = adminAuthorName
			isAdmin = true
		}

		posts = append(posts, map[string]interface{}{
			"id":          id,
			"title":       title,
			"content":     content,
			"is_pinned":   isPinned == 1,
			"created_at":  createdAt,
			"updated_at":  updatedAt,
			"author":      author,
			"is_admin":    isAdmin,
			"reply_count": replyCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"data":      posts,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetForumPost 获取单个帖子及其回复
func GetForumPost(c *gin.Context) {
	postID := c.Param("id")

	// 获取帖子信息
	var post struct {
		ID        int
		UserID    sql.NullInt64
		AdminID   sql.NullInt64
		Title     string
		Content   string
		IsPinned  int
		CreatedAt int64
		UpdatedAt int64
		Author    string
		IsAdmin   bool
	}

	var authorName, adminAuthorName sql.NullString
	err := database.DB.QueryRow(`
		SELECT
			fp.id, fp.user_id, fp.admin_id, fp.title, fp.content, fp.is_pinned, fp.created_at, fp.updated_at,
			COALESCE(u.nickname, u.email) as author_name,
			a.username as admin_author_name
		FROM forum_posts fp
		LEFT JOIN users u ON fp.user_id = u.id
		LEFT JOIN admins a ON fp.admin_id = a.id
		WHERE fp.id = ?
	`, postID).Scan(&post.ID, &post.UserID, &post.AdminID, &post.Title, &post.Content, &post.IsPinned, &post.CreatedAt, &post.UpdatedAt, &authorName, &adminAuthorName)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "帖子不存在"})
		return
	}

	if adminAuthorName.Valid && adminAuthorName.String != "" {
		post.Author = adminAuthorName.String
		post.IsAdmin = true
	} else if authorName.Valid {
		post.Author = authorName.String
		post.IsAdmin = false
	}

	// 获取回复列表（包括嵌套回复）
	rows, err := database.DB.Query(`
		SELECT
			fr.id, fr.parent_reply_id, fr.content, fr.created_at,
			COALESCE(u.nickname, u.email) as user_name,
			COALESCE(a.username, '') as admin_name
		FROM forum_replies fr
		LEFT JOIN users u ON fr.user_id = u.id
		LEFT JOIN admins a ON fr.admin_id = a.id
		WHERE fr.post_id = ?
		ORDER BY fr.created_at ASC
	`, postID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询回复失败"})
		return
	}
	defer rows.Close()

	var replies []map[string]interface{}
	for rows.Next() {
		var id int
		var parentReplyID sql.NullInt64
		var content, userName, adminName string
		var createdAt int64

		err := rows.Scan(&id, &parentReplyID, &content, &createdAt, &userName, &adminName)
		if err != nil {
			continue
		}

		author := userName
		isAdmin := false
		if adminName != "" {
			author = adminName
			isAdmin = true
		}

		reply := map[string]interface{}{
			"id":         id,
			"content":    content,
			"created_at": createdAt,
			"author":     author,
			"is_admin":   isAdmin,
		}

		if parentReplyID.Valid {
			reply["parent_reply_id"] = int(parentReplyID.Int64)
		}

		replies = append(replies, reply)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"post": map[string]interface{}{
			"id":         post.ID,
			"user_id":    post.UserID.Int64,
			"admin_id":   post.AdminID.Int64,
			"title":      post.Title,
			"content":    post.Content,
			"is_pinned":  post.IsPinned == 1,
			"created_at": post.CreatedAt,
			"updated_at": post.UpdatedAt,
			"author":     post.Author,
			"is_admin":   post.IsAdmin,
		},
		"replies": replies,
	})
}

// CreateForumPost 创建帖子（用户或管理员）
func CreateForumPost(c *gin.Context) {
	var req struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 检查是用户还是管理员
	userID, userExists := c.Get("user_id")
	adminID, adminExists := c.Get("admin_id")

	var result sql.Result
	var err error

	now := time.Now().Unix()

	if userExists {
		// 用户创建帖子
		result, err = database.DB.Exec(
			"INSERT INTO forum_posts (user_id, title, content, is_pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
			userID, req.Title, req.Content, now, now,
		)
	} else if adminExists {
		// 管理员创建帖子
		result, err = database.DB.Exec(
			"INSERT INTO forum_posts (admin_id, title, content, is_pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
			adminID, req.Title, req.Content, now, now,
		)
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未授权"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建失败"})
		return
	}

	postID, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "发布成功", "post_id": postID})
}

// CreateForumReply 回复帖子
func CreateForumReply(c *gin.Context) {
	postID := c.Param("id")

	var req struct {
		Content       string `json:"content" binding:"required"`
		ParentReplyID *int   `json:"parent_reply_id"` // 可选，用于嵌套回复
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 检查帖子是否存在
	var exists int
	err := database.DB.QueryRow("SELECT COUNT(*) FROM forum_posts WHERE id = ?", postID).Scan(&exists)
	if err != nil || exists == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "帖子不存在"})
		return
	}

	// 检查是用户还是管理员
	userID, userExists := c.Get("user_id")
	adminID, adminExists := c.Get("admin_id")

	var result sql.Result

	now := time.Now().Unix()

	if userExists {
		// 用户回复
		if req.ParentReplyID != nil {
			result, err = database.DB.Exec(
				"INSERT INTO forum_replies (post_id, parent_reply_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)",
				postID, req.ParentReplyID, userID, req.Content, now,
			)
		} else {
			result, err = database.DB.Exec(
				"INSERT INTO forum_replies (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
				postID, userID, req.Content, now,
			)
		}
	} else if adminExists {
		// 管理员回复
		if req.ParentReplyID != nil {
			result, err = database.DB.Exec(
				"INSERT INTO forum_replies (post_id, parent_reply_id, admin_id, content, created_at) VALUES (?, ?, ?, ?, ?)",
				postID, req.ParentReplyID, adminID, req.Content, now,
			)
		} else {
			result, err = database.DB.Exec(
				"INSERT INTO forum_replies (post_id, admin_id, content, created_at) VALUES (?, ?, ?, ?)",
				postID, adminID, req.Content, now,
			)
		}
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未授权"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "回复失败"})
		return
	}

	// 更新帖子的 updated_at
	database.DB.Exec("UPDATE forum_posts SET updated_at = ? WHERE id = ?", now, postID)

	replyID, _ := result.LastInsertId()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "回复成功", "reply_id": replyID})
}

// PinForumPost 置顶/取消置顶帖子（仅管理员）
func PinForumPost(c *gin.Context) {
	postID := c.Param("id")

	var req struct {
		IsPinned bool `json:"is_pinned"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	pinValue := 0
	if req.IsPinned {
		pinValue = 1
	}

	_, err := database.DB.Exec("UPDATE forum_posts SET is_pinned = ? WHERE id = ?", pinValue, postID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "操作失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "操作成功"})
}

// UpdateForumPost 编辑帖子（仅作者或管理员）
func UpdateForumPost(c *gin.Context) {
	postID := c.Param("id")

	var req struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}

	// 获取帖子信息
	var post struct {
		UserID  sql.NullInt64
		AdminID sql.NullInt64
	}

	err := database.DB.QueryRow("SELECT user_id, admin_id FROM forum_posts WHERE id = ?", postID).Scan(&post.UserID, &post.AdminID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "帖子不存在"})
		return
	}

	// 检查权限
	userID, userExists := c.Get("user_id")
	_, adminExists := c.Get("admin_id")

	canEdit := false

	if adminExists {
		// 管理员可以编辑任何帖子
		canEdit = true
	} else if userExists && post.UserID.Valid && int(post.UserID.Int64) == userID.(int) {
		// 用户只能编辑自己的帖子
		canEdit = true
	}

	if !canEdit {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权编辑此帖子"})
		return
	}

	// 更新帖子
	now := time.Now().Unix()
	_, err = database.DB.Exec("UPDATE forum_posts SET title = ?, content = ?, updated_at = ? WHERE id = ?", req.Title, req.Content, now, postID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "更新成功"})
}

// DeleteForumPost 删除帖子（仅管理员或帖子作者）
func DeleteForumPost(c *gin.Context) {
	postID := c.Param("id")

	// 获取帖子信息
	var post struct {
		UserID  sql.NullInt64
		AdminID sql.NullInt64
	}

	err := database.DB.QueryRow("SELECT user_id, admin_id FROM forum_posts WHERE id = ?", postID).Scan(&post.UserID, &post.AdminID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "帖子不存在"})
		return
	}

	// 检查权限
	userID, userExists := c.Get("user_id")
	_, adminExists := c.Get("admin_id")

	canDelete := false

	if adminExists {
		// 管理员可以删除任何帖子
		canDelete = true
	} else if userExists && post.UserID.Valid && int(post.UserID.Int64) == userID.(int) {
		// 用户只能删除自己的帖子
		canDelete = true
	}

	if !canDelete {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权删除此帖子"})
		return
	}

	// 删除帖子及其回复
	_, err = database.DB.Exec("DELETE FROM forum_replies WHERE post_id = ?", postID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败"})
		return
	}

	_, err = database.DB.Exec("DELETE FROM forum_posts WHERE id = ?", postID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "删除成功"})
}
func GetMyForumPosts(c *gin.Context) {
	userID, userExists := c.Get("user_id")
	if !userExists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未授权"})
		return
	}

	rows, err := database.DB.Query(`
		SELECT
			fp.id, fp.title, fp.content, fp.is_pinned, fp.created_at,
			COUNT(fr.id) as reply_count
		FROM forum_posts fp
		LEFT JOIN forum_replies fr ON fp.id = fr.post_id
		WHERE fp.user_id = ?
		GROUP BY fp.id
		ORDER BY fp.created_at DESC
	`, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询失败"})
		return
	}
	defer rows.Close()

	var posts []map[string]interface{}
	for rows.Next() {
		var id, isPinned int
		var title, content string
		var createdAt int64
		var replyCount int

		err := rows.Scan(&id, &title, &content, &isPinned, &createdAt, &replyCount)
		if err != nil {
			continue
		}

		posts = append(posts, map[string]interface{}{
			"id":          id,
			"title":       title,
			"content":     content,
			"is_pinned":   isPinned == 1,
			"created_at":  createdAt,
			"reply_count": replyCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": posts})
}

// GetMyForumReplies 获取我的回复
func GetMyForumReplies(c *gin.Context) {
	userID, userExists := c.Get("user_id")
	if !userExists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未授权"})
		return
	}

	rows, err := database.DB.Query(`
		SELECT
			fr.id, fr.post_id, fr.content, fr.created_at,
			fp.title as post_title
		FROM forum_replies fr
		INNER JOIN forum_posts fp ON fr.post_id = fp.id
		WHERE fr.user_id = ?
		ORDER BY fr.created_at DESC
	`, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询失败"})
		return
	}
	defer rows.Close()

	var replies []map[string]interface{}
	for rows.Next() {
		var id, postID int
		var content, postTitle string
		var createdAt int64

		err := rows.Scan(&id, &postID, &content, &createdAt, &postTitle)
		if err != nil {
			continue
		}

		replies = append(replies, map[string]interface{}{
			"id":         id,
			"post_id":    postID,
			"post_title": postTitle,
			"content":    content,
			"created_at": createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": replies})
}

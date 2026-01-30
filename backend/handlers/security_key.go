package handlers

import (
	"net/http"

	"invite-backend/utils"

	"github.com/gin-gonic/gin"
)

// GetSecurityKey 获取当前加密密钥（用于前端加密）
func GetSecurityKey(c *gin.Context) {
	km := utils.GetKeyManager()
	currentKey := km.GetCurrentKey()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"key":     currentKey,
	})
}


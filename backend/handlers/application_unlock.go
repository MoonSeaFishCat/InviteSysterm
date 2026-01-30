package handlers

import (
	"net/http"
	"strconv"

	"invite-backend/services"

	"github.com/gin-gonic/gin"
)

// UnlockApplication 解锁申请（用户关闭详情页时调用）
func UnlockApplication(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的申请ID"})
		return
	}

	// 获取当前管理员信息
	adminID, exists := c.Get("admin_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未授权"})
		return
	}

	currentAdminID := adminID.(int)

	// 解锁申请
	lockManager := services.GetLockManager()
	lockManager.UnlockApplication(id, currentAdminID)

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已解锁"})
}

// RefreshLock 刷新锁定（用户在详情页时定期调用）
func RefreshLock(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的申请ID"})
		return
	}

	// 获取当前管理员信息
	adminID, exists := c.Get("admin_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未授权"})
		return
	}

	adminName, _ := c.Get("admin_username")
	currentAdminID := adminID.(int)
	currentAdminName := adminName.(string)

	// 刷新锁定
	lockManager := services.GetLockManager()
	success := lockManager.LockApplication(id, currentAdminID, currentAdminName)

	if !success {
		lock := lockManager.GetLock(id)
		c.JSON(http.StatusLocked, gin.H{
			"success":  false,
			"message":  "锁定已被其他管理员占用",
			"lockedBy": lock.AdminName,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "锁定已刷新"})
}


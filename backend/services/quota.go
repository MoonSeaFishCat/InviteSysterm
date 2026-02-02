package services

import (
	"invite-backend/database"
	"log"
	"strconv"
	"time"
)

// StartQuotaChecker 启动审核员指标检查器
func StartQuotaChecker() {
	// 每天检查一次
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			CheckWeeklyQuota()
		}
	}()
}

// CheckWeeklyQuota 检查审核员周指标
func CheckWeeklyQuota() {
	log.Println("Checking weekly audit quota...")

	// 获取指标设置
	var quotaStr string
	err := database.DB.QueryRow("SELECT value FROM settings WHERE key = 'weekly_audit_quota'").Scan(&quotaStr)
	if err != nil {
		log.Printf("Failed to get weekly_audit_quota: %v\n", err)
		return
	}
	quota, _ := strconv.Atoi(quotaStr)
	if quota <= 0 {
		return
	}

	// 获取所有审核员
	rows, err := database.DB.Query("SELECT id, username, created_at, linuxdo_id FROM admins WHERE role = 'reviewer' AND status = 'active'")
	if err != nil {
		log.Printf("Failed to get reviewers: %v\n", err)
		return
	}
	defer rows.Close()

	now := time.Now().Unix()
	sevenDaysAgo := time.Now().AddDate(0, 0, -7).Unix()

	for rows.Next() {
		var id int
		var username string
		var createdAt int64
		var linuxdoID *string
		if err := rows.Scan(&id, &username, &createdAt, &linuxdoID); err != nil {
			continue
		}

		// 如果账号创建不满7天，暂不考核
		if createdAt > sevenDaysAgo {
			continue
		}

		// 检查过去7天的审核数量
		var count int
		err := database.DB.QueryRow(`
			SELECT COUNT(*) FROM applications 
			WHERE processed_by = ? AND updated_at >= ? AND status IN ('approved', 'rejected')
		`, id, sevenDaysAgo).Scan(&count)

		if err != nil {
			log.Printf("Failed to count audits for %s: %v\n", username, err)
			continue
		}

		if count < quota {
			log.Printf("Admin %s failed to meet quota (%d/%d). Demoting and banning.\n", username, count, quota)

			// 移除权限并拉黑
			_, err = database.DB.Exec(
				"UPDATE admins SET role = 'commenter', status = 'banned', updated_at = ? WHERE id = ?",
				now, id,
			)
			if err != nil {
				log.Printf("Failed to demote admin %s: %v\n", username, err)
			}

			// 如果有 Linux DO ID，也加入黑名单
			if linuxdoID != nil && *linuxdoID != "" {
				_, _ = database.DB.Exec(
					"INSERT INTO blacklist (type, value, reason, created_at, updated_at) VALUES ('linuxdo_id', ?, ?, ?, ?)",
					*linuxdoID, "审核指标未达标 (7天内审核量: "+strconv.Itoa(count)+", 要求: "+strconv.Itoa(quota)+")", now, now,
				)
			}
		}
	}
}

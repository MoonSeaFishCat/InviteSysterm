package services

import (
	"database/sql"
	"fmt"
	"log"

	"invite-backend/database"
)

// GetSystemSettings 获取所有系统设置
func GetSystemSettings() (map[string]string, error) {
	rows, err := database.DB.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		settings[key] = value
	}

	return settings, nil
}

// GetEmailService 根据系统设置创建邮件服务
func GetEmailService() (*EmailService, error) {
	settings, err := GetSystemSettings()
	if err != nil {
		return nil, err
	}

	host := settings["smtp_host"]
	port := 465
	fmt.Sscanf(settings["smtp_port"], "%d", &port)
	user := settings["smtp_user"]
	pass := settings["smtp_pass"]

	if host == "" || user == "" {
		return nil, fmt.Errorf("SMTP not configured")
	}

	return NewEmailService(host, port, user, pass), nil
}

// UpdateSettings 更新系统设置
func UpdateSettings(settings map[string]string) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("UPDATE settings SET value = ? WHERE key = ?")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for key, value := range settings {
		if _, err := stmt.Exec(value, key); err != nil {
			log.Printf("Failed to update setting %s: %v", key, err)
		}
	}

	return tx.Commit()
}

// CheckApplicationStatus 检查申请状态
func CheckApplicationStatus(fingerprint string) (hasPending, hasApproved bool, err error) {
	query := `
		SELECT status FROM applications 
		WHERE device_id = ? AND status IN ('pending', 'approved')
		LIMIT 1
	`
	var status string
	err = database.DB.QueryRow(query, fingerprint).Scan(&status)

	if err == sql.ErrNoRows {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}

	return status == "pending", status == "approved", nil
}

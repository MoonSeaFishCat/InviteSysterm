package database

import (
	"database/sql"
	"log"
	"time"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

// InitDB 初始化数据库
func InitDB(dbPath string) error {
	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	// 测试连接
	if err = DB.Ping(); err != nil {
		return err
	}

	// 创建表
	if err = createTables(); err != nil {
		return err
	}

	// 初始化默认设置
	if err = initDefaultSettings(); err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

// ToUnixTimestamp 将数据库返回的时间值转换为 Unix 时间戳
func ToUnixTimestamp(v interface{}) int64 {
	switch t := v.(type) {
	case int64:
		return t
	case int:
		return int64(t)
	case time.Time:
		return t.Unix()
	case *time.Time:
		if t != nil {
			return t.Unix()
		}
	}
	return 0
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS applications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL,
		reason TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		device_id TEXT NOT NULL,
		ip TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		admin_note TEXT
	);

	CREATE TABLE IF NOT EXISTS verification_codes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL,
		code TEXT NOT NULL,
		expires_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS invitation_codes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		code TEXT NOT NULL UNIQUE,
		is_used INTEGER NOT NULL DEFAULT 0,
		application_id INTEGER REFERENCES applications(id),
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		key TEXT NOT NULL UNIQUE,
		value TEXT NOT NULL,
		description TEXT,
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS announcements (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		content TEXT NOT NULL,
		is_active INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
	CREATE INDEX IF NOT EXISTS idx_applications_device ON applications(device_id);
	CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
	CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
	`

	_, err := DB.Exec(schema)
	return err
}

func initDefaultSettings() error {
	defaultSettings := map[string]string{
		"application_open":            "true",
		"risk_control_enabled":        "true",
		"email_whitelist":             "",
		"max_applications_per_email":  "1",
		"max_applications_per_device": "1",
		"smtp_host":                   "",
		"smtp_port":                   "465",
		"smtp_user":                   "",
		"smtp_pass":                   "",
		"site_name":                   "小汐的邀请码申请系统",
		"home_announcement":           "欢迎来到小汐的邀请码申请系统，请认真填写您的申请理由，我们将用心审核每一份申请。\nPS：小汐也不知道项目会运行多久 一切随缘（确信）大概率应该是小汐跌出三级？",
		"admin_username":              "admin",
		"admin_password_hash":         "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // admin
	}

	for key, value := range defaultSettings {
		_, err := DB.Exec(`
			INSERT INTO settings (key, value, updated_at) 
			VALUES (?, ?, ?)
			ON CONFLICT(key) DO NOTHING
		`, key, value, time.Now().Unix())
		if err != nil {
			return err
		}
	}

	return nil
}

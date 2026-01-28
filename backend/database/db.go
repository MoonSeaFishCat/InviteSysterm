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

	// 迁移管理员数据并初始化默认管理员
	if err = migrateAdmins(); err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

func migrateAdmins() error {
	// 检查是否已经有管理员
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM admins").Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		// 尝试从 settings 表获取旧的管理员信息
		var username, passwordHash string
		err = DB.QueryRow("SELECT value FROM settings WHERE key = 'admin_username'").Scan(&username)
		if err == nil {
			err = DB.QueryRow("SELECT value FROM settings WHERE key = 'admin_password_hash'").Scan(&passwordHash)
		}

		// 如果获取失败（新安装），使用默认值
		if err != nil {
			username = "admin"
			passwordHash = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" // admin
		}

		// 插入第一个超级管理员
		_, err = DB.Exec(`
			INSERT INTO admins (username, password_hash, role, created_at, updated_at)
			VALUES (?, ?, 'super', ?, ?)
		`, username, passwordHash, time.Now().Unix(), time.Now().Unix())
		if err != nil {
			return err
		}

		log.Printf("Default super admin '%s' created\n", username)
	}

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

	CREATE TABLE IF NOT EXISTS admins (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT, -- 对于 Linux DO 用户，该字段可以为空
		role TEXT NOT NULL DEFAULT 'reviewer', -- super, reviewer
		linuxdo_id TEXT UNIQUE, -- Linux DO 的用户 ID
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
	CREATE INDEX IF NOT EXISTS idx_applications_device ON applications(device_id);
	CREATE TABLE IF NOT EXISTS audit_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		admin_id INTEGER REFERENCES admins(id),
		admin_username TEXT,
		action TEXT NOT NULL, -- approve, reject
		application_id INTEGER REFERENCES applications(id),
		target_email TEXT,
		details TEXT,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_app ON audit_logs(application_id);
	CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
	CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
	`

	_, err := DB.Exec(schema)
	if err != nil {
		return err
	}

	// 检查并添加 linuxdo_id 字段
	_, _ = DB.Exec("ALTER TABLE admins ADD COLUMN linuxdo_id TEXT")
	_, _ = DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_linuxdo_id ON admins(linuxdo_id)")

	return nil
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
		"linuxdo_client_id":           "",
		"linuxdo_client_secret":       "",
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

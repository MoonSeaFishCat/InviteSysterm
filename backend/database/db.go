package database

import (
	"database/sql"
	"invite-backend/config"
	"invite-backend/utils"
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
	// 1. 确保超级管理员存在
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM admins WHERE role = 'super'").Scan(&count)
	if err != nil {
		return err
	}

	// 从配置获取
	configUsername := "admin"
	if config.AppConfig.AdminUsername != "" {
		configUsername = config.AppConfig.AdminUsername
	}

	configPasswordHash := ""
	if config.AppConfig.AdminPassword != "" && config.AppConfig.AdminPassword != "your_admin_password_here" {
		configPasswordHash = utils.HashPassword(config.AppConfig.AdminPassword)
	}

	if count == 0 {
		// 如果不存在超级管理员，创建一个
		username := configUsername
		passwordHash := configPasswordHash

		// 如果没有配置密码，使用默认的 admin/admin
		if passwordHash == "" {
			passwordHash = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" // admin
		}

		_, err = DB.Exec(`
			INSERT INTO admins (username, password_hash, role, created_at, updated_at)
			VALUES (?, ?, 'super', ?, ?)
		`, username, passwordHash, time.Now().Unix(), time.Now().Unix())
		if err != nil {
			return err
		}
		log.Printf("Default super admin '%s' created\n", username)
	} else if configPasswordHash != "" {
		// 如果已经存在超级管理员，且配置了新密码，则强制同步配置中的用户名和密码
		// 这方便用户通过 .env 重置密码
		_, err = DB.Exec(`
			UPDATE admins 
			SET username = ?, password_hash = ?, updated_at = ? 
			WHERE role = 'super'
		`, configUsername, configPasswordHash, time.Now().Unix())
		if err != nil {
			log.Printf("Failed to sync admin credentials from config: %v\n", err)
		} else {
			log.Printf("Super admin '%s' credentials synced from config\n", configUsername)
		}
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
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		nickname TEXT,
		status TEXT NOT NULL DEFAULT 'active', -- active, banned
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS tickets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id),
		subject TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'open', -- open, replied, closed
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS ticket_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		ticket_id INTEGER NOT NULL REFERENCES tickets(id),
		sender_type TEXT NOT NULL, -- user, admin
		sender_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id),
		title TEXT NOT NULL,
		content TEXT NOT NULL,
		is_read INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS applications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER REFERENCES users(id), -- 关联登录用户
		email TEXT NOT NULL,
		reason TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		device_id TEXT NOT NULL,
		ip TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		admin_note TEXT,
		review_opinion TEXT,
		processed_by INTEGER REFERENCES admins(id)
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
		permissions TEXT DEFAULT '', -- 权限列表，逗号分隔，例如 'applications,tickets,messages'
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

	CREATE TABLE IF NOT EXISTS blacklist (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		type TEXT NOT NULL, -- email, device, ip
		value TEXT NOT NULL,
		reason TEXT,
		created_by INTEGER REFERENCES admins(id),
		created_by_username TEXT,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE INDEX IF NOT EXISTS idx_blacklist_type_value ON blacklist(type, value);
	CREATE INDEX IF NOT EXISTS idx_blacklist_value ON blacklist(value);

	CREATE TABLE IF NOT EXISTS admin_chat_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		admin_id INTEGER NOT NULL REFERENCES admins(id),
		admin_username TEXT NOT NULL,
		admin_role TEXT NOT NULL,
		message TEXT NOT NULL,
		is_pinned INTEGER NOT NULL DEFAULT 0,
		is_featured INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE INDEX IF NOT EXISTS idx_admin_chat_created ON admin_chat_messages(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_admin_chat_admin ON admin_chat_messages(admin_id);
	CREATE INDEX IF NOT EXISTS idx_admin_chat_pinned ON admin_chat_messages(is_pinned DESC, created_at DESC);

	CREATE TABLE IF NOT EXISTS forum_posts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER REFERENCES users(id),
		admin_id INTEGER REFERENCES admins(id),
		title TEXT NOT NULL,
		content TEXT NOT NULL,
		is_pinned INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS forum_replies (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		post_id INTEGER NOT NULL REFERENCES forum_posts(id),
		parent_reply_id INTEGER REFERENCES forum_replies(id),
		user_id INTEGER REFERENCES users(id),
		admin_id INTEGER REFERENCES admins(id),
		content TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_forum_posts_pinned ON forum_posts(is_pinned DESC, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_forum_replies_post ON forum_replies(post_id, created_at ASC);
	CREATE INDEX IF NOT EXISTS idx_forum_replies_parent ON forum_replies(parent_reply_id, created_at ASC);
	`

	_, err := DB.Exec(schema)
	if err != nil {
		return err
	}

	// 检查并添加 permissions 字段到 admins 表
	_, _ = DB.Exec("ALTER TABLE admins ADD COLUMN permissions TEXT DEFAULT ''")

	// 检查并添加 linuxdo_id 字段
	_, _ = DB.Exec("ALTER TABLE admins ADD COLUMN linuxdo_id TEXT")
	_, _ = DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_linuxdo_id ON admins(linuxdo_id)")

	// 检查并添加 review_opinion 字段
	_, _ = DB.Exec("ALTER TABLE applications ADD COLUMN review_opinion TEXT")
	// 检查并添加 processed_by 字段
	_, _ = DB.Exec("ALTER TABLE applications ADD COLUMN processed_by INTEGER")

	// 检查并添加 user_id 字段到 applications
	_, _ = DB.Exec("ALTER TABLE applications ADD COLUMN user_id INTEGER")

	// 检查并添加聊天消息的置顶和加精字段
	_, _ = DB.Exec("ALTER TABLE admin_chat_messages ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0")
	_, _ = DB.Exec("ALTER TABLE admin_chat_messages ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0")
	_, _ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_admin_chat_pinned ON admin_chat_messages(is_pinned DESC, created_at DESC)")

	// 添加性能索引
	_, _ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_applications_ip ON applications(ip)")
	_, _ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_applications_processed_by ON applications(processed_by)")

	// 添加密码重置令牌表
	_, _ = DB.Exec(`
		CREATE TABLE IF NOT EXISTS password_reset_tokens (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL,
			token TEXT NOT NULL UNIQUE,
			expires_at INTEGER NOT NULL,
			used INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
		)
	`)
	_, _ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email)")
	_, _ = DB.Exec("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)")

	return nil
}

func initDefaultSettings() error {
	defaultSettings := map[string]string{
		"application_open":             "true",
		"risk_control_enabled":         "true",
		"max_applications_per_email":   "1",
		"max_applications_per_device":  "1",
		"max_applications_per_ip":      "3",
		"smtp_host":                    "",
		"smtp_port":                    "465",
		"smtp_user":                    "",
		"smtp_pass":                    "",
		"site_name":                    "小汐的邀请码申请系统",
		"home_announcement":            "欢迎来到小汐的邀请码申请系统，请认真填写您的申请理由，我们将用心审核每一份申请。\nPS：小汐也不知道项目会运行多久 一切随缘（确信）大概率应该是小汐跌出三级？",
		"linuxdo_client_id":            "",
		"linuxdo_client_secret":        "",
		"linuxdo_min_trust_level":      "3",
		"allow_auto_admin_reg":         "true",
		"default_reviewer_permissions": "applications,tickets,messages", // 默认审核员权限
		"email_whitelist":              "",                              // 留空表示不限制，多个用逗号分隔，如 @gmail.com,test@example.com
		"geetest_id":                   "",
		"geetest_key":                  "",
		"geetest_enabled":              "false",
		"reg_email_verify_enabled":     "true",
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

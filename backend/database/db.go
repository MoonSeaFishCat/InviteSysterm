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
	// 检查并添加 audit_count 字段到 admins 表
	if _, execErr := DB.Exec("ALTER TABLE admins ADD COLUMN audit_count INTEGER DEFAULT 0"); execErr != nil {
		log.Printf("Note: ALTER TABLE admins audit_count: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE admins ADD COLUMN last_audit_at INTEGER"); execErr != nil {
		log.Printf("Note: ALTER TABLE admins last_audit_at: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE admins ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); execErr != nil {
		log.Printf("Note: ALTER TABLE admins status: %v\n", execErr)
	}

	// 检查并添加 AIGC 检测相关字段到 applications 表
	if _, execErr := DB.Exec("ALTER TABLE applications ADD COLUMN aigc_score INTEGER DEFAULT -1"); execErr != nil {
		log.Printf("Note: ALTER TABLE applications aigc_score: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE applications ADD COLUMN aigc_confidence TEXT"); execErr != nil {
		log.Printf("Note: ALTER TABLE applications aigc_confidence: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE applications ADD COLUMN aigc_evidence TEXT"); execErr != nil {
		log.Printf("Note: ALTER TABLE applications aigc_evidence: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE applications ADD COLUMN aigc_analysis TEXT"); execErr != nil {
		log.Printf("Note: ALTER TABLE applications aigc_analysis: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE applications ADD COLUMN aigc_relevance INTEGER DEFAULT 0"); execErr != nil {
		log.Printf("Note: ALTER TABLE applications aigc_relevance: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE applications ADD COLUMN aigc_authenticity INTEGER DEFAULT 0"); execErr != nil {
		log.Printf("Note: ALTER TABLE applications aigc_authenticity: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE applications ADD COLUMN aigc_completeness INTEGER DEFAULT 0"); execErr != nil {
		log.Printf("Note: ALTER TABLE applications aigc_completeness: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE applications ADD COLUMN aigc_expression INTEGER DEFAULT 0"); execErr != nil {
		log.Printf("Note: ALTER TABLE applications aigc_expression: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE applications ADD COLUMN aigc_reply TEXT"); execErr != nil {
		log.Printf("Note: ALTER TABLE applications aigc_reply: %v\n", execErr)
	}

	// 检查并添加 chat_messages 表
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS chat_messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sender_id INTEGER NOT NULL,
			sender_username TEXT NOT NULL,
			sender_role TEXT NOT NULL,
			sender_type TEXT NOT NULL DEFAULT 'admin',
			content TEXT NOT NULL,
			quote_id INTEGER REFERENCES chat_messages(id),
			is_private INTEGER NOT NULL DEFAULT 0,
			receiver_id INTEGER,
			receiver_type TEXT,
			is_pinned INTEGER NOT NULL DEFAULT 0,
			is_featured INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
		)
	`)
	if err != nil {
		log.Printf("Failed to create chat_messages table: %v\n", err)
	}

	if _, execErr := DB.Exec("ALTER TABLE chat_messages ADD COLUMN sender_type TEXT NOT NULL DEFAULT 'admin'"); execErr != nil {
		log.Printf("Note: ALTER TABLE chat_messages sender_type: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE chat_messages ADD COLUMN receiver_type TEXT"); execErr != nil {
		log.Printf("Note: ALTER TABLE chat_messages receiver_type: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE chat_messages ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0"); execErr != nil {
		log.Printf("Note: ALTER TABLE chat_messages is_featured: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE chat_messages ADD COLUMN receiver_id INTEGER"); execErr != nil {
		log.Printf("Note: ALTER TABLE chat_messages receiver_id: %v\n", execErr)
	}
	if _, execErr := DB.Exec("ALTER TABLE chat_messages ADD COLUMN room TEXT"); execErr != nil {
		log.Printf("Note: ALTER TABLE chat_messages room: %v\n", execErr)
	}

	// 检查并添加 application_votes 表
	_, _ = DB.Exec(`
		CREATE TABLE IF NOT EXISTS application_votes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			application_id INTEGER NOT NULL REFERENCES applications(id),
			voter_id INTEGER NOT NULL REFERENCES admins(id),
			voter_username TEXT NOT NULL,
			opinion TEXT NOT NULL,
			comment TEXT,
			created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
		)
	`)

	// 检查并添加 auditor_applications 表
	_, _ = DB.Exec(`
		CREATE TABLE IF NOT EXISTS auditor_applications (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			admin_id INTEGER NOT NULL REFERENCES admins(id),
			reason TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
			processed_by INTEGER REFERENCES admins(id)
		)
	`)

	// 检查并添加 weekly_audit_quota 设置
	_, _ = DB.Exec("INSERT INTO settings (key, value, description, updated_at) VALUES ('weekly_audit_quota', '10', '审核员每周需要完成的审核数量', ?) ON CONFLICT(key) DO NOTHING", time.Now().Unix())

	// 添加 LLM 相关设置
	defaultPrompt := `你现在是一位2025–2026年顶尖的AI文本取证与对抗样本分析师，同时具备中文学术写作、网络社区写作、营销文案、虚构小说等多种语体鉴别经验。

你的核心任务是：**尽可能准确判断给定的文本片段更大概率是由人类撰写，还是由当前主流大语言模型（包括但不限于GPT-4o系列、Claude 3.5/4、Gemini 2.0/2.5、Grok 3/4、DeepSeek-R1、Qwen 2.5-max、Llama-4系列、通义千问、豆包、Kimi等）生成或高度改写**。

请严格按照以下分步思考流程，不要跳步，不要提前下结论：

─────────────────────────────
阶段1：表面统计与模式匹配（必须量化）
─────────────────────────────
A. 句子长度与段落长度分布
   - 计算平均句长、句长标准差
   - 观察是否存在“句长过于均匀”（方差<8–10个汉字算异常）
   - 段落是否长度高度相似（尤其是4–8句/段的规律性）

B. 标点与排版习惯
   - 破折号（——）、冒号（：）+长插入语的频率
   - 括号解释句 / 补充说明句 的密度
   - 是否频繁出现“、”连续罗列超过4项

C. 高频功能词与模板化连接词（中文AI特别容易残留）
   - 统计并标记出现次数：从而、进而、因此、可见、不难看出、综上所述、由此可见、值得注意的是、可以看出、换言之、换句话说、另一方面、一方面……另一方面、不仅……而且、所谓、所谓的、其实、本质上、归根结底、总的来说、总而言之
   - 出现3个以上同类连接词且分布均匀 → 大幅加分AI倾向

D. 结构化表达倾向
   - 是否出现明显的“总-分-总”三段式、问题-分析-结论式
   - 是否有规整的“首先、其次、最后/综上”或“第一、第二、第三”
   - 是否每段首句高度概括或承上启下

─────────────────────────────
阶段2：语义与逻辑层面的AI指纹（更关键）
─────────────────────────────
E. 过度中立、过度平衡、假辩证
   - 是否同时肯定两边、用“但是”“然而”制造假对立后又调和
   - 是否出现“双刃剑”“利弊并存”“仁者见仁智者见智”式空洞总结

F. 事实陈述的泛化、空洞与“安全感”
   - 是否大量使用“通常”“一般而言”“在大多数情况下”“众所周知”
   - 是否回避具体年份、数据来源、争议细节，倾向于圆滑概括

G. 情感真实度与个性残留
   - 是否存在真正的主观偏见、情绪波动、个人化吐槽、反常识小抱怨
   - 是否完全没有语气词、口语残留（啊、吧、呗、嘛、啦、哎、其实我感觉……）

─────────────────────────────
阶段3：2025–2026年最新高级模型残留特征（最难模仿的部分）
─────────────────────────────
H. “隐形模板病”——即使刻意口语化也难完全消除
   - 微弱的“礼貌过载”：无必要客套、过度使用“我们”“您会发现”“相信大家都能理解”
   - 结尾强行“升华/展望/呼吁”倾向（让我们、期待、值得深思、未来可期……）
   - 轻微的“语义平滑过度”：几乎没有真正生硬的逻辑跳跃或前后小矛盾

I. 对抗性人类化失败的常见痕迹
   - 刻意加入的“错误”太均匀（错别字、口语化太有规律）
   - 刻意打乱段落但内在逻辑链仍然完整可逆推

─────────────────────────────
阶段4：综合判决（必须给出明确倾向）
─────────────────────────────
请在以上所有维度分析完成后，综合给出结果。

注意：为了适配系统可视化展示，你的输出必须包含以下格式的总结部分，方便程序解析：
[SUMMARY_START]
AI生成概率: [数字]%
置信度: [极高/高/中/低/极低]
相关性: [数字]
真实性: [数字]
完整性: [数字]
表达能力: [数字]
参考回复: [一段建议的回复文字]
关键证据:
1. [证据1]
2. [证据2]
3. [证据3]
[SUMMARY_END]
`
	_, _ = DB.Exec("INSERT INTO settings (key, value, description, updated_at) VALUES ('llm_api_key', '', 'LLM API 密钥', ?) ON CONFLICT(key) DO NOTHING", time.Now().Unix())
	_, _ = DB.Exec("INSERT INTO settings (key, value, description, updated_at) VALUES ('llm_base_url', 'https://api.openai.com/v1', 'LLM API 基础地址', ?) ON CONFLICT(key) DO NOTHING", time.Now().Unix())
	_, _ = DB.Exec("INSERT INTO settings (key, value, description, updated_at) VALUES ('llm_model', 'gpt-4o', 'LLM 模型名称', ?) ON CONFLICT(key) DO NOTHING", time.Now().Unix())
	_, _ = DB.Exec("INSERT INTO settings (key, value, description, updated_at) VALUES ('llm_system_prompt', ?, 'AIGC 检测系统提示词', ?) ON CONFLICT(key) DO NOTHING", defaultPrompt, time.Now().Unix())

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
		role TEXT NOT NULL DEFAULT 'commenter', -- super, reviewer, commenter
		permissions TEXT DEFAULT '', -- 权限列表，逗号分隔，例如 'applications,tickets,messages'
		linuxdo_id TEXT UNIQUE, -- Linux DO 的用户 ID
		audit_count INTEGER DEFAULT 0, -- 审核数量
		last_audit_at INTEGER, -- 最后审核时间
		status TEXT NOT NULL DEFAULT 'active', -- active, banned
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS application_votes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		application_id INTEGER NOT NULL REFERENCES applications(id),
		voter_id INTEGER NOT NULL REFERENCES admins(id),
		voter_username TEXT NOT NULL,
		opinion TEXT NOT NULL, -- agree, reject
		comment TEXT,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE TABLE IF NOT EXISTS auditor_applications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		admin_id INTEGER NOT NULL REFERENCES admins(id),
		reason TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
		processed_by INTEGER REFERENCES admins(id)
	);

	CREATE TABLE IF NOT EXISTS chat_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sender_id INTEGER NOT NULL,
		sender_username TEXT NOT NULL,
		sender_role TEXT NOT NULL,
		sender_type TEXT NOT NULL DEFAULT 'admin', -- admin, user
		content TEXT NOT NULL,
		quote_id INTEGER REFERENCES chat_messages(id),
		is_private INTEGER NOT NULL DEFAULT 0, -- 0: global, 1: private
		receiver_id INTEGER, -- if is_private is 1
		receiver_type TEXT, -- admin, user
		is_pinned INTEGER NOT NULL DEFAULT 0,
		is_featured INTEGER NOT NULL DEFAULT 0,
		room TEXT,
		created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
	);

	CREATE INDEX IF NOT EXISTS idx_chat_private ON chat_messages(is_private, receiver_id, sender_id);
	CREATE INDEX IF NOT EXISTS idx_application_votes_app ON application_votes(application_id);
	CREATE INDEX IF NOT EXISTS idx_auditor_apps_admin ON auditor_applications(admin_id);

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
		"auditor_no_review":            "false",
		"weekly_audit_quota":           "10", // 每周最小审核量
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

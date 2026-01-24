import { db } from "./index";
import { sql } from "drizzle-orm";

async function init() {
  console.log("Initializing database...");
  
  // Create tables manually if not using migrations for simplicity
  db.run(sql`
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
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS invitation_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      is_used INTEGER NOT NULL DEFAULT 0,
      application_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (application_id) REFERENCES applications (id)
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Initialize default settings if not exists
  const defaultSettings = [
    { key: "smtp_host", value: process.env.SMTP_HOST || "", description: "SMTP 服务器地址" },
    { key: "smtp_port", value: process.env.SMTP_PORT || "465", description: "SMTP 端口" },
    { key: "smtp_user", value: process.env.SMTP_USER || "", description: "SMTP 用户名" },
    { key: "smtp_pass", value: process.env.SMTP_PASS || "", description: "SMTP 密码" },
    { key: "email_whitelist", value: "", description: "邮箱后缀白名单 (逗号分隔, 如: linux.do,gmail.com)" },
    { key: "risk_control_enabled", value: "true", description: "是否开启风控" },
    { key: "max_applications_per_device", value: "1", description: "每个设备最大申请数" },
    { key: "max_applications_per_email", value: "1", description: "每个邮箱最大申请数" },
  ];

  for (const setting of defaultSettings) {
    db.run(sql`
      INSERT OR IGNORE INTO settings (key, value, description)
      VALUES (${setting.key}, ${setting.value}, ${setting.description})
    `);
  }

  console.log("Database initialized.");
}

init().catch(console.error);

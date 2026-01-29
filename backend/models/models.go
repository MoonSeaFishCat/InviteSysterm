package models

import "time"

// Application 申请记录
type Application struct {
	ID            int       `json:"id" db:"id"`
	Email         string    `json:"email" db:"email"`
	Reason        string    `json:"reason" db:"reason"`
	Status        string    `json:"status" db:"status"` // pending, approved, rejected
	DeviceID      string    `json:"deviceId" db:"device_id"`
	IP            string    `json:"ip" db:"ip"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`
	AdminNote     string    `json:"adminNote" db:"admin_note"`
	ReviewOpinion string    `json:"reviewOpinion" db:"review_opinion"`
	ProcessedBy   *int      `json:"processedBy" db:"processed_by"`
	AdminUsername string    `json:"adminUsername" db:"admin_username"`
}

// VerificationCode 验证码
type VerificationCode struct {
	ID        int       `json:"id" db:"id"`
	Email     string    `json:"email" db:"email"`
	Code      string    `json:"code" db:"code"`
	ExpiresAt time.Time `json:"expiresAt" db:"expires_at"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

// InvitationCode 邀请码
type InvitationCode struct {
	ID            int       `json:"id" db:"id"`
	Code          string    `json:"code" db:"code"`
	IsUsed        bool      `json:"isUsed" db:"is_used"`
	ApplicationID *int      `json:"applicationId" db:"application_id"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
}

// Setting 系统设置
type Setting struct {
	ID          int       `json:"id" db:"id"`
	Key         string    `json:"key" db:"key"`
	Value       string    `json:"value" db:"value"`
	Description string    `json:"description" db:"description"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// Admin 管理员账号
type Admin struct {
	ID           int       `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Role         string    `json:"role" db:"role"` // super, reviewer
	LinuxDoID    string    `json:"linuxdoId" db:"linuxdo_id"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// SystemSettings 系统配置集合
type SystemSettings struct {
	ApplicationOpen          string `json:"application_open"`
	RiskControlEnabled       string `json:"risk_control_enabled"`
	EmailWhitelist           string `json:"email_whitelist"`
	MaxApplicationsPerEmail  string `json:"max_applications_per_email"`
	MaxApplicationsPerDevice string `json:"max_applications_per_device"`
	MaxApplicationsPerIP     string `json:"max_applications_per_ip"`
	SMTPHost                 string `json:"smtp_host"`
	SMTPPort                 string `json:"smtp_port"`
	SMTPUser                 string `json:"smtp_user"`
	SMTPPass                 string `json:"smtp_pass"`
	LinuxDoClientID          string `json:"linuxdo_client_id"`
	LinuxDoClientSecret      string `json:"linuxdo_client_secret"`
}

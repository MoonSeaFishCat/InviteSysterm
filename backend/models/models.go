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
	ID           int        `json:"id" db:"id"`
	Username     string     `json:"username" db:"username"`
	PasswordHash string     `json:"-" db:"password_hash"`
	Role         string     `json:"role" db:"role"` // super, reviewer, commenter
	Permissions  string     `json:"permissions" db:"permissions"`
	LinuxDoID    string     `json:"linuxdoId" db:"linuxdo_id"`
	AuditCount   int        `json:"auditCount" db:"audit_count"`
	LastAuditAt  *time.Time `json:"lastAuditAt" db:"last_audit_at"`
	Status       string     `json:"status" db:"status"` // active, banned
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time  `json:"updatedAt" db:"updated_at"`
}

// ChatMessage 聊天消息
type ChatMessage struct {
	ID             int       `json:"id" db:"id"`
	SenderID       int       `json:"senderId" db:"sender_id"`
	SenderUsername string    `json:"senderUsername" db:"sender_username"`
	SenderRole     string    `json:"senderRole" db:"sender_role"`
	SenderType     string    `json:"senderType" db:"sender_type"` // admin, user
	Content        string    `json:"message" db:"content"`        // 适配前端字段名 message
	QuoteID        *int      `json:"quoteId" db:"quote_id"`
	QuoteContent   string    `json:"quoteContent" db:"-"` // 辅助显示引用内容
	IsPrivate      bool      `json:"isPrivate" db:"is_private"`
	ReceiverID     *int      `json:"receiverId" db:"receiver_id"`
	ReceiverType   string    `json:"receiverType" db:"receiver_type"` // admin, user
	IsPinned       bool      `json:"isPinned" db:"is_pinned"`
	IsFeatured     bool      `json:"isFeatured" db:"is_featured"`
	CreatedAt      time.Time `json:"createdAt" db:"created_at"`
}

// ApplicationVote 申请投票
type ApplicationVote struct {
	ID            int       `json:"id" db:"id"`
	ApplicationID int       `json:"applicationId" db:"application_id"`
	VoterID       int       `json:"voterId" db:"voter_id"`
	VoterUsername string    `json:"voterUsername" db:"voter_username"`
	Opinion       string    `json:"opinion" db:"opinion"` // agree, reject
	Comment       string    `json:"comment" db:"comment"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
}

// AuditorApplication 审核员申请
type AuditorApplication struct {
	ID            int       `json:"id" db:"id"`
	AdminID       int       `json:"adminId" db:"admin_id"`
	AdminUsername string    `json:"adminUsername" db:"admin_username"`
	Reason        string    `json:"reason" db:"reason"`
	Status        string    `json:"status" db:"status"` // pending, approved, rejected
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	ProcessedBy   *int      `json:"processedBy" db:"processed_by"`
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
	WeeklyAuditQuota         string `json:"weekly_audit_quota"`
}

// Blacklist 黑名单
type Blacklist struct {
	ID                int       `json:"id" db:"id"`
	Type              string    `json:"type" db:"type"` // email, device, ip
	Value             string    `json:"value" db:"value"`
	Reason            string    `json:"reason" db:"reason"`
	CreatedBy         int       `json:"createdBy" db:"created_by"`
	CreatedByUsername string    `json:"createdByUsername" db:"created_by_username"`
	CreatedAt         time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt         time.Time `json:"updatedAt" db:"updated_at"`
}

// User 用户
type User struct {
	ID           int       `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Nickname     string    `json:"nickname" db:"nickname"`
	Status       string    `json:"status" db:"status"` // active, banned
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

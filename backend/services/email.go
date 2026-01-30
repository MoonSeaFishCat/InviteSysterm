package services

import (
	"crypto/tls"
	"fmt"
	"time"

	"gopkg.in/gomail.v2"
)

// EmailService 邮件服务
type EmailService struct {
	Host     string
	Port     int
	User     string
	Password string
}

// NewEmailService 创建邮件服务
func NewEmailService(host string, port int, user, password string) *EmailService {
	return &EmailService{
		Host:     host,
		Port:     port,
		User:     user,
		Password: password,
	}
}

// SendVerificationCode 发送验证码
func (e *EmailService) SendVerificationCode(to, code string) error {
	fmt.Printf("[DEBUG] 准备发送邮件 - To: %s, Code: %s\n", to, code)
	fmt.Printf("[DEBUG] SMTP配置 - Host: %s, Port: %d, User: %s\n", e.Host, e.Port, e.User)

	// 添加短暂延迟，避免触发阿里云反垃圾邮件机制
	time.Sleep(2 * time.Second)

	m := gomail.NewMessage()
	m.SetHeader("From", e.User)
	m.SetHeader("To", to)
	m.SetHeader("Subject", "✨ 您的验证码 - L站邀请码申请")

	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Arial', 'Microsoft YaHei', sans-serif; background-color: #fdfbf7; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #f093fb 0%%, #f5576c 100%%); padding: 40px 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .code-box { background: linear-gradient(135deg, #ffecd2 0%%, #fcb69f 100%%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
        .code { font-size: 36px; font-weight: bold; color: #d63384; letter-spacing: 8px; margin: 10px 0; }
        .tip { color: #6c757d; font-size: 14px; line-height: 1.6; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
        .quote { background: #fff5f5; border-left: 4px solid #f5576c; padding: 15px 20px; margin: 20px 0; color: #666; font-style: italic; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💌 L站邀请码申请</h1>
        </div>
        <div class="content">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">您好！</p>
            <p style="color: #666; line-height: 1.8;">感谢您申请 L 站邀请码。为了验证您的邮箱地址，请使用以下验证码：</p>
            
            <div class="code-box">
                <div style="color: #666; font-size: 14px; margin-bottom: 10px;">您的验证码</div>
                <div class="code">%s</div>
                <div style="color: #999; font-size: 12px; margin-top: 10px;">有效期 10 分钟</div>
            </div>
            
            <div class="tip">
                <p style="margin: 5px 0;">📌 <strong>温馨提示：</strong></p>
                <p style="margin: 5px 0;">• 请勿将验证码泄露给他人</p>
                <p style="margin: 5px 0;">• 如非本人操作，请忽略此邮件</p>
            </div>
            
            <div class="quote">
                "生活总会有不期而遇的温暖，和生生不息的希望。"
            </div>
        </div>
        <div class="footer">
            <p style="margin: 5px 0;">此邮件由系统自动发送，请勿回复</p>
            <p style="margin: 5px 0;">© 2026 L站邀请码分发系统</p>
        </div>
    </div>
</body>
</html>
	`, code)

	m.SetBody("text/html", htmlBody)
	// 同时设置纯文本备用
	m.AddAlternative("text/plain", fmt.Sprintf("您的验证码是 %s，有效期 10 分钟。", code))

	fmt.Printf("[DEBUG] 开始连接 SMTP 服务器...\n")
	d := gomail.NewDialer(e.Host, e.Port, e.User, e.Password)
	d.TLSConfig = &tls.Config{InsecureSkipVerify: true}

	err := d.DialAndSend(m)
	if err != nil {
		fmt.Printf("[ERROR] SMTP 发送失败: %v\n", err)
		return err
	}

	fmt.Printf("[DEBUG] 邮件发送成功\n")
	return nil
}

// SendApprovalEmail 发送通过邮件
func (e *EmailService) SendApprovalEmail(to, code, note string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", e.User)
	m.SetHeader("To", to)
	m.SetHeader("Subject", "🎉 恭喜！您的邀请码申请已通过")

	noteHTML := ""
	if note != "" {
		noteHTML = fmt.Sprintf(`
			<div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px 20px; margin: 25px 0; border-radius: 4px;">
				<div style="color: #0369a1; font-weight: 600; margin-bottom: 8px;">📝 审核意见</div>
				<div style="color: #334155; line-height: 1.6;">%s</div>
			</div>
		`, note)
	}

	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Arial', 'Microsoft YaHei', sans-serif; background-color: #fdfbf7; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #a8edea 0%%, #fed6e3 100%%); padding: 50px 30px; text-align: center; position: relative; }
        .header::before { content: '🎉'; font-size: 60px; display: block; margin-bottom: 10px; }
        .header h1 { color: #2d3748; margin: 0; font-size: 28px; font-weight: 600; }
        .header p { color: #4a5568; margin: 10px 0 0 0; font-size: 16px; }
        .content { padding: 40px 30px; }
        .success-badge { background: linear-gradient(135deg, #84fab0 0%%, #8fd3f4 100%%); color: #065f46; padding: 8px 20px; border-radius: 20px; display: inline-block; font-weight: 600; font-size: 14px; margin-bottom: 20px; }
        .code-section { background: linear-gradient(135deg, #ffeaa7 0%%, #fdcb6e 100%%); border-radius: 16px; padding: 30px; text-align: center; margin: 30px 0; box-shadow: 0 4px 15px rgba(253, 203, 110, 0.3); }
        .code-label { color: #744210; font-size: 14px; font-weight: 600; margin-bottom: 15px; }
        .code { font-size: 32px; font-weight: bold; color: #d97706; letter-spacing: 6px; margin: 10px 0; font-family: 'Courier New', monospace; background: #ffffff; padding: 15px 25px; border-radius: 8px; display: inline-block; }
        .instructions { background: #f8fafc; border-radius: 12px; padding: 25px; margin: 25px 0; }
        .instruction-title { color: #1e293b; font-weight: 600; font-size: 16px; margin-bottom: 15px; display: flex; align-items: center; }
        .instruction-title::before { content: '📚'; font-size: 20px; margin-right: 8px; }
        .instruction-list { color: #475569; line-height: 2; margin: 0; padding-left: 20px; }
        .instruction-list li { margin: 8px 0; }
        .quote { background: linear-gradient(135deg, #ffecd2 0%%, #fcb69f 20%%, #ffecd2 100%%); border-left: 4px solid #f5576c; padding: 20px 25px; margin: 25px 0; color: #333; font-style: italic; border-radius: 8px; text-align: center; font-size: 15px; line-height: 1.8; }
        .footer { background: linear-gradient(to right, #ffecd2 0%%, #fcb69f 100%%); padding: 30px; text-align: center; }
        .footer-emoji { font-size: 24px; margin-bottom: 10px; }
        .footer-text { color: #666; font-size: 14px; line-height: 1.6; margin: 5px 0; }
        .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 30px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>申请审核通过</h1>
            <p>欢迎加入 L 站大家庭</p>
        </div>
        <div class="content">
            <div style="text-align: center;">
                <span class="success-badge">✅ 审核通过</span>
            </div>
            
            <p style="font-size: 16px; color: #333; margin: 20px 0;">亲爱的用户：</p>
            <p style="color: #666; line-height: 1.8; margin-bottom: 25px;">
                恭喜您！经过我们的仔细审核，您的 L 站邀请码申请已经通过啦！🎊
            </p>
            
            <div class="code-section">
                <div class="code-label">🎁 您的专属邀请码</div>
                <div class="code">%s</div>
                <div style="color: #92400e; font-size: 12px; margin-top: 15px;">请妥善保管，每个邀请码仅限使用一次</div>
            </div>

%s

            <div class="instructions">
                <div class="instruction-title">使用说明</div>
                <ol class="instruction-list">
                    <li>访问 L 站注册页面</li>
                    <li>填写您的注册信息</li>
                    <li>在邀请码输入框中填入上方邀请码</li>
                    <li>完成注册，开启精彩旅程</li>
                </ol>
            </div>

            <div class="divider"></div>
            
            <div class="quote">
                💝<br>
                "每一个温暖的相遇，都值得被珍惜。<br>
                愿你在 L 站遇见更多美好，收获无限快乐！"
            </div>
        </div>
        <div class="footer">
            <div class="footer-emoji">🌸 🌟 🎈</div>
            <p class="footer-text">感谢您的耐心等待</p>
            <p class="footer-text">祝您在 L 站玩得开心！</p>
            <p class="footer-text" style="margin-top: 20px; font-size: 12px; color: #999;">
                此邮件由系统自动发送，请勿回复<br>
                © 2026 L站邀请码分发系统 · 治愈系设计
            </p>
        </div>
    </div>
</body>
</html>
	`, code, noteHTML)

	m.SetBody("text/html", htmlBody)
	// 纯文本备用
	textBody := fmt.Sprintf(`
🎉 恭喜您！您的 L 站邀请码申请已通过审核。

您的邀请码：%s

%s

感谢您的耐心等待，祝您在 L 站玩得开心！

---
此邮件由系统自动发送，请勿回复
© 2026 L站邀请码分发系统
	`, code, note)
	m.AddAlternative("text/plain", textBody)

	d := gomail.NewDialer(e.Host, e.Port, e.User, e.Password)
	d.TLSConfig = &tls.Config{InsecureSkipVerify: true}

	return d.DialAndSend(m)
}

// SendRejectionEmail 发送拒绝邮件
func (e *EmailService) SendRejectionEmail(to, reason string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", e.User)
	m.SetHeader("To", to)
	m.SetHeader("Subject", "关于您的邀请码申请 - L站")

	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Arial', 'Microsoft YaHei', sans-serif; background-color: #fdfbf7; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #f6d365 0%%, #fda085 100%%); padding: 40px 30px; text-align: center; }
        .header-icon { font-size: 50px; margin-bottom: 10px; }
        .header h1 { color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .status-badge { background: #fef2f2; color: #dc2626; padding: 8px 20px; border-radius: 20px; display: inline-block; font-weight: 600; font-size: 14px; margin-bottom: 20px; border: 2px solid #fecaca; }
        .reason-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px 25px; margin: 25px 0; border-radius: 8px; }
        .reason-title { color: #92400e; font-weight: 600; margin-bottom: 10px; font-size: 15px; }
        .reason-text { color: #78350f; line-height: 1.8; margin: 0; }
        .tips { background: #f0f9ff; border-radius: 12px; padding: 20px 25px; margin: 25px 0; }
        .tips-title { color: #0369a1; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; }
        .tips-title::before { content: '💡'; font-size: 20px; margin-right: 8px; }
        .tips-list { color: #075985; line-height: 2; margin: 0; padding-left: 20px; }
        .tips-list li { margin: 8px 0; }
        .quote { background: linear-gradient(135deg, #e0c3fc 0%%, #8ec5fc 100%%); padding: 20px 25px; margin: 25px 0; color: #1e293b; font-style: italic; border-radius: 8px; text-align: center; line-height: 1.8; }
        .footer { background: #f8f9fa; padding: 25px 30px; text-align: center; color: #6c757d; font-size: 13px; border-top: 1px solid #e9ecef; line-height: 1.6; }
        .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 30px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">📋</div>
            <h1>关于您的申请结果</h1>
        </div>
        <div class="content">
            <div style="text-align: center;">
                <span class="status-badge">审核未通过</span>
            </div>
            
            <p style="font-size: 16px; color: #333; margin: 20px 0;">亲爱的用户：</p>
            <p style="color: #666; line-height: 1.8; margin-bottom: 20px;">
                感谢您对 L 站的关注和申请。经过我们的审核，很遗憾地通知您，您的邀请码申请未能通过。
            </p>
            
            <div class="reason-box">
                <div class="reason-title">📌 审核意见</div>
                <p class="reason-text">%s</p>
            </div>

            <div class="tips">
                <div class="tips-title">温馨建议</div>
                <ul class="tips-list">
                    <li>您可以在完善相关信息后重新申请</li>
                    <li>申请理由请尽量详细、真诚</li>
                    <li>确保提供的邮箱真实有效</li>
                    <li>遇到问题可联系管理员咨询</li>
                </ul>
            </div>

            <div class="divider"></div>
            
            <div class="quote">
                🌈<br>
                "每一次尝试都是成长的机会，<br>
                希望下次能看到更完善的申请。"
            </div>

            <p style="color: #64748b; font-size: 14px; text-align: center; margin-top: 30px;">
                如有任何疑问，欢迎联系管理员
            </p>
        </div>
        <div class="footer">
            <p style="margin: 5px 0;">此邮件由系统自动发送，请勿回复</p>
            <p style="margin: 5px 0;">© 2026 L站邀请码分发系统 · 治愈系设计</p>
        </div>
    </div>
</body>
</html>
	`, reason)

	m.SetBody("text/html", htmlBody)
	// 纯文本备用
	textBody := fmt.Sprintf(`
关于您的邀请码申请

很抱歉，您的 L 站邀请码申请未能通过审核。

拒绝原因：%s

温馨建议：
• 您可以在完善相关信息后重新申请
• 申请理由请尽量详细、真诚
• 确保提供的邮箱真实有效

如有疑问，请联系管理员。

---
此邮件由系统自动发送，请勿回复
© 2026 L站邀请码分发系统
	`, reason)
	m.AddAlternative("text/plain", textBody)

	d := gomail.NewDialer(e.Host, e.Port, e.User, e.Password)
	d.TLSConfig = &tls.Config{InsecureSkipVerify: true}

	return d.DialAndSend(m)
}

// SendPasswordResetEmail 发送密码重置邮件
func (e *EmailService) SendPasswordResetEmail(to, token string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", e.User)
	m.SetHeader("To", to)
	m.SetHeader("Subject", "🔐 密码重置请求 - L站邀请码申请系统")

	// 构建重置链接（这里需要根据实际前端地址配置）
	resetLink := fmt.Sprintf("http://localhost:5173/reset-password?token=%s", token)

	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Arial', 'Microsoft YaHei', sans-serif; background-color: #fdfbf7; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 40px 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .reset-box { background: linear-gradient(135deg, #e0c3fc 0%%, #8ec5fc 100%%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
        .reset-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); color: #ffffff; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); }
        .reset-button:hover { opacity: 0.9; }
        .tip { color: #6c757d; font-size: 14px; line-height: 1.6; margin: 20px 0; background: #f8f9fa; padding: 15px 20px; border-radius: 8px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px; margin: 20px 0; color: #856404; border-radius: 4px; }
        .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 密码重置</h1>
        </div>
        <div class="content">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">您好！</p>
            <p style="color: #666; line-height: 1.8;">我们收到了您的密码重置请求。请点击下方按钮重置您的密码：</p>

            <div class="reset-box">
                <div style="color: #333; font-size: 14px; margin-bottom: 15px;">点击按钮重置密码</div>
                <a href="%s" class="reset-button">重置密码</a>
                <div style="color: #666; font-size: 12px; margin-top: 15px;">链接有效期 30 分钟</div>
            </div>

            <div class="warning">
                <p style="margin: 5px 0;"><strong>⚠️ 安全提示：</strong></p>
                <p style="margin: 5px 0;">• 如果您没有请求重置密码，请忽略此邮件</p>
                <p style="margin: 5px 0;">• 请勿将此链接分享给任何人</p>
                <p style="margin: 5px 0;">• 链接仅可使用一次</p>
            </div>

            <div class="tip">
                <p style="margin: 5px 0;">如果按钮无法点击，请复制以下链接到浏览器：</p>
                <p style="margin: 10px 0; word-break: break-all; color: #667eea;">%s</p>
            </div>
        </div>
        <div class="footer">
            <p style="margin: 5px 0;">此邮件由系统自动发送，请勿回复</p>
            <p style="margin: 5px 0;">© 2026 L站邀请码分发系统</p>
        </div>
    </div>
</body>
</html>
	`, resetLink, resetLink)

	m.SetBody("text/html", htmlBody)
	m.AddAlternative("text/plain", fmt.Sprintf("您的密码重置链接：%s\n\n链接有效期 30 分钟。如果您没有请求重置密码，请忽略此邮件。", resetLink))

	d := gomail.NewDialer(e.Host, e.Port, e.User, e.Password)
	d.TLSConfig = &tls.Config{InsecureSkipVerify: true}

	return d.DialAndSend(m)
}

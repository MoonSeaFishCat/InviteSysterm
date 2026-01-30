package main

import (
	"log"
	"math/rand"
	"time"

	"invite-backend/config"
	"invite-backend/database"
	"invite-backend/handlers"
	"invite-backend/middleware"
	"invite-backend/utils"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func main() {
	// 加载配置
	config.LoadConfig()

	// 初始化密钥管理器（自动生成随机密钥并启动定期轮换）
	utils.GetKeyManager()

	// 设置 Gin 模式
	if config.AppConfig.GinMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 初始化数据库
	if err := database.InitDB(config.AppConfig.DBPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 创建 Gin 引擎
	r := gin.New() // 使用 New 而不是 Default，避免重复注册中间件
	r.Use(gin.Logger(), gin.Recovery())

	// 设置信任代理（如果你的程序运行在 Nginx 等反向代理之后，请设置正确的代理 IP）
	// 默认信任本地环回地址，这样可以获取到 X-Forwarded-For 等头部的真实 IP
	r.SetTrustedProxies([]string{"127.0.0.1", "::1"})

	// CORS 配置
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 公开 API 路由
	api := r.Group("/api")
	// 全局频率限制：每分钟最多 60 个请求
	limiter := middleware.NewRateLimiter(60, time.Minute)
	api.Use(limiter.Middleware())
	{
		// 统计信息
		api.GET("/stats", handlers.GetPublicStats)

		// 获取加密密钥
		api.GET("/security/key", handlers.GetSecurityKey)

		// 验证码相关
		api.POST("/verification-code", handlers.SendVerificationCode)
		api.POST("/register-code", handlers.SendRegistrationCode)
		api.GET("/captcha", handlers.GetCaptcha)

		// 安全挑战
		api.GET("/security-challenge", handlers.GetSecurityChallenge)

		// 申请相关
		api.POST("/application/status", handlers.CheckApplicationStatus)

		// 用户相关
		user := api.Group("/user")
		{
			user.POST("/register", handlers.UserRegister)
			user.POST("/login", handlers.UserLogin)

			// 需要认证的用户路由
			userAuth := user.Group("", middleware.UserAuthMiddleware())
			{
				userAuth.GET("/profile", handlers.GetUserProfile)
				userAuth.GET("/profile/stats", handlers.GetUserProfileStats)
				userAuth.POST("/profile", handlers.UpdateUserProfile)
				userAuth.PUT("/profile", handlers.UpdateUserProfile)
				userAuth.PUT("/password", handlers.ChangeUserPassword)
				userAuth.GET("/applications", handlers.GetUserApplications)
				userAuth.POST("/application/submit", handlers.SubmitApplication)

				// 工单相关
				userAuth.GET("/tickets", handlers.GetUserTickets)
				userAuth.POST("/tickets", handlers.CreateTicket)
				userAuth.GET("/tickets/:id/messages", handlers.GetTicketMessages)
				userAuth.POST("/tickets/:id/reply", handlers.ReplyTicket)

				// 站内信相关
				userAuth.GET("/messages", handlers.GetUserMessages)
				userAuth.POST("/messages/:id/read", handlers.ReadMessage)
				userAuth.POST("/messages/read-all", handlers.ReadAllMessages)
			}
		}

		// 公告相关
		api.GET("/announcements", handlers.GetAnnouncements)

		// 密码重置相关
		api.POST("/password/request-reset", handlers.RequestPasswordReset)
		api.GET("/password/verify-token", handlers.VerifyResetToken)
		api.POST("/password/reset", handlers.ResetPassword)

		// 管理员路由
		admin := api.Group("/admin")
		{
			// 登录登出
			admin.POST("/login", handlers.AdminLogin)
			admin.POST("/logout", handlers.AdminLogout)

			// Linux DO 登录
			admin.GET("/linuxdo", handlers.LinuxDoLogin)
			admin.GET("/linuxdo/callback", handlers.LinuxDoCallback)

			// 需要认证的路由
			authenticated := admin.Group("", middleware.AuthMiddleware())
			{
				// 所有管理员都能访问的
				authenticated.GET("/stats", handlers.AdminGetStats)
				authenticated.GET("/applications", handlers.GetApplications)
				authenticated.POST("/review", handlers.ReviewApplication)
				authenticated.POST("/applications/batch-review", handlers.AdminBatchReviewApplications)
				authenticated.POST("/applications/batch-delete", handlers.AdminBatchDeleteApplications)
				authenticated.POST("/change-password", handlers.ChangePassword)
				authenticated.GET("/me", handlers.GetMe) // 获取当前用户信息
				authenticated.GET("/users", handlers.AdminGetUsers)

				// 管理员工单管理
				authenticated.GET("/tickets", handlers.AdminGetTickets)
				authenticated.GET("/tickets/:id/messages", handlers.GetTicketMessages) // 复用用户侧的详情获取，但需要管理员鉴权逻辑在 handler 中区分或新建
				authenticated.POST("/tickets/:id/reply", handlers.AdminReplyTicket)
				authenticated.POST("/tickets/:id/close", handlers.AdminCloseTicket)
				authenticated.POST("/tickets/:id/reopen", handlers.AdminReopenTicket)
				authenticated.DELETE("/tickets/:id", handlers.AdminDeleteTicket)

				// 管理员站内信
				authenticated.POST("/messages/send", handlers.AdminSendMessage)
				authenticated.POST("/messages/batch-send", handlers.AdminBatchSendMessage)
				authenticated.GET("/messages/history", handlers.AdminGetAllMessages)

				// 只有超级管理员能访问的
				super := authenticated.Group("", middleware.RoleMiddleware("super"))
				{
					super.GET("/settings", handlers.GetSettings)
					super.POST("/settings/update", handlers.UpdateSettings)
					super.GET("/audit-logs", handlers.GetAuditLogs)

					// 公告管理
					super.GET("/announcements", handlers.GetAnnouncements)
					super.POST("/announcements", handlers.AddAnnouncement)
					super.DELETE("/announcements/:id", handlers.DeleteAnnouncement)
					super.POST("/announcements/:id/toggle", handlers.ToggleAnnouncement)

					// 管理员管理
					super.GET("/admins", handlers.GetAdmins)
					super.POST("/admins", handlers.AddAdmin)
					super.DELETE("/admins/:id", handlers.DeleteAdmin)
					super.PUT("/admins/:id", handlers.UpdateAdmin)

					// 用户管理
					super.GET("/all-users", handlers.GetAllUsers)
					super.GET("/all-users/:id", handlers.GetUserDetail)
					super.PUT("/all-users/:id/status", handlers.UpdateUserStatus)
					super.DELETE("/all-users/:id", handlers.DeleteUser)
					super.POST("/all-users/:id/reset-password", handlers.ResetUserPassword)

					// 黑名单管理
					super.GET("/blacklist", handlers.GetBlacklist)
					super.POST("/blacklist", handlers.AddBlacklist)
					super.PUT("/blacklist/:id", handlers.UpdateBlacklist)
					super.DELETE("/blacklist/:id", handlers.DeleteBlacklist)

					// 申请管理
					super.DELETE("/applications/:id", handlers.DeleteApplication)
				}
			}
		}
	}

	// 启动服务器之前设置静态文件服务
	ServeStatic(r)

	// 启动服务器
	addr := ":" + config.AppConfig.Port
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

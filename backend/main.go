package main

import (
	"log"
	"math/rand"
	"time"

	"invite-backend/config"
	"invite-backend/database"
	"invite-backend/handlers"
	"invite-backend/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func main() {
	// 加载配置
	config.LoadConfig()

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
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 公开 API 路由
	api := r.Group("/api")
	{
		// 统计信息
		api.GET("/stats", handlers.GetStats)

		// 验证码相关
		api.POST("/verification-code", handlers.SendVerificationCode)
		api.GET("/captcha", handlers.GetCaptcha)

		// 安全挑战
		api.GET("/security-challenge", handlers.GetSecurityChallenge)

		// 申请相关
		api.POST("/application/submit", handlers.SubmitApplication)
		api.POST("/application/status", handlers.CheckApplicationStatus)

		// 公告相关
		api.GET("/announcements", handlers.GetAnnouncements)

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
				authenticated.GET("/applications", handlers.GetApplications)
				authenticated.POST("/review", handlers.ReviewApplication)
				authenticated.POST("/change-password", handlers.ChangePassword)
				authenticated.GET("/me", handlers.GetMe) // 获取当前用户信息

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

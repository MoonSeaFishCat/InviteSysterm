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

	// 设置信任代理（解决警告）
	r.SetTrustedProxies(nil)

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

			// 需要认证的路由
			authenticated := admin.Group("", middleware.AuthMiddleware())
			{
				authenticated.GET("/applications", handlers.GetApplications)
				authenticated.POST("/review", handlers.ReviewApplication)
				authenticated.GET("/settings", handlers.GetSettings)
				authenticated.POST("/settings/update", handlers.UpdateSettings)
				authenticated.POST("/change-password", handlers.ChangePassword)

				// 公告管理
				authenticated.GET("/announcements", handlers.GetAnnouncements)
				authenticated.POST("/announcements", handlers.AddAnnouncement)
				authenticated.DELETE("/announcements/:id", handlers.DeleteAnnouncement)
				authenticated.POST("/announcements/:id/toggle", handlers.ToggleAnnouncement)
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

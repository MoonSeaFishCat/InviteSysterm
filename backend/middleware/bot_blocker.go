package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// BotBlockerMiddleware 阻止扫描器和爬虫
func BotBlockerMiddleware() gin.HandlerFunc {
	// 常见的扫描器和爬虫 User-Agent 特征
	blockedUserAgents := []string{
		"scanner",
		"bot",
		"crawler",
		"spider",
		"scraper",
		"curl",
		"wget",
		"python",
		"java",
		"go-http-client",
		"masscan",
		"nmap",
		"nikto",
		"sqlmap",
		"acunetix",
		"nessus",
		"openvas",
		"metasploit",
		"burp",
		"zap",
		"w3af",
		"dirbuster",
		"gobuster",
		"wfuzz",
		"hydra",
		"nuclei",
		"httpx",
		"subfinder",
		"amass",
		"shodan",
		"censys",
		"zoomeye",
	}

	// 允许的搜索引擎爬虫（可选）
	allowedBots := []string{
		"googlebot",
		"bingbot",
		"baiduspider",
		// 注意：Google Safe Browsing 也使用 Googlebot，但我们需要阻止它访问管理后台
	}

	return func(c *gin.Context) {
		userAgent := strings.ToLower(c.GetHeader("User-Agent"))
		path := c.Request.URL.Path

		// 如果是管理后台路径，进行更严格的检查
		if strings.HasPrefix(path, "/admin") {
			// 阻止所有爬虫访问管理后台（包括搜索引擎）
			for _, bot := range append(blockedUserAgents, allowedBots...) {
				if strings.Contains(userAgent, bot) {
					c.JSON(http.StatusForbidden, gin.H{
						"success": false,
						"message": "Access denied",
					})
					c.Abort()
					return
				}
			}

			// 检查是否有 User-Agent（扫描器通常没有或使用默认值）
			if userAgent == "" || userAgent == "-" {
				c.JSON(http.StatusForbidden, gin.H{
					"success": false,
					"message": "Access denied",
				})
				c.Abort()
				return
			}
		} else {
			// 对于非管理后台路径，只阻止恶意扫描器
			for _, bot := range blockedUserAgents {
				if strings.Contains(userAgent, bot) {
					c.JSON(http.StatusForbidden, gin.H{
						"success": false,
						"message": "Access denied",
					})
					c.Abort()
					return
				}
			}
		}

		c.Next()
	}
}


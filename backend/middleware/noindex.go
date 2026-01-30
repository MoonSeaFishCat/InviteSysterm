package middleware

import (
	"github.com/gin-gonic/gin"
)

// NoIndexMiddleware 添加 X-Robots-Tag 响应头，禁止搜索引擎收录
func NoIndexMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 添加 X-Robots-Tag 响应头，禁止所有搜索引擎收录
		c.Header("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noimageindex")
		c.Next()
	}
}


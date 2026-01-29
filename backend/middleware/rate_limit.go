package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter 简单的基于 IP 的频率限制器
type RateLimiter struct {
	requests map[string][]time.Time
	mu       sync.Mutex
	limit    int           // 限制次数
	window   time.Duration // 时间窗口
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		now := time.Now()

		rl.mu.Lock()
		defer rl.mu.Unlock()

		// 清理过期请求
		if _, ok := rl.requests[ip]; ok {
			var valid []time.Time
			for _, t := range rl.requests[ip] {
				if now.Sub(t) < rl.window {
					valid = append(valid, t)
				}
			}
			rl.requests[ip] = valid
		}

		// 检查限制
		if len(rl.requests[ip]) >= rl.limit {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"message": "请求过于频繁，请稍后再试",
			})
			c.Abort()
			return
		}

		// 记录新请求
		rl.requests[ip] = append(rl.requests[ip], now)
		c.Next()
	}
}

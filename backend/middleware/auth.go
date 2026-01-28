package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"invite-backend/config"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// SessionStore 简单的内存会话存储
var SessionStore = make(map[string]bool)

// AuthMiddleware 管理员认证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 尝试从 Authorization Header 获取 Token
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString := parts[1]
				token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
					if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
						return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
					}
					return []byte(config.AppConfig.JWTSecret), nil
				})

				if err == nil && token.Valid {
					if claims, ok := token.Claims.(jwt.MapClaims); ok {
						c.Set("admin_id", int(claims["id"].(float64)))
						c.Set("admin_username", claims["username"].(string))
						c.Set("admin_role", claims["role"].(string))
						c.Next()
						return
					}
				}
			}
		}

		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "请登录后操作"})
		c.Abort()
	}
}

// RoleMiddleware 角色权限中间件
func RoleMiddleware(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminRole, exists := c.Get("admin_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "请登录后操作"})
			c.Abort()
			return
		}

		roleStr := adminRole.(string)
		allowed := false
		for _, role := range roles {
			if roleStr == role {
				allowed = true
				break
			}
		}

		if !allowed {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "权限不足，无法访问该页面"})
			c.Abort()
			return
		}

		c.Next()
	}
}

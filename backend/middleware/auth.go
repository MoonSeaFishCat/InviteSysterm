package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"invite-backend/config"
	"invite-backend/database"

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
						adminID := int(claims["id"].(float64))
						c.Set("admin_id", adminID)
						c.Set("admin_username", claims["username"].(string))
						c.Set("admin_role", claims["role"].(string))

						// 从数据库获取权限信息
						var permissions string
						err := database.DB.QueryRow("SELECT permissions FROM admins WHERE id = ?", adminID).Scan(&permissions)
						if err == nil {
							c.Set("admin_permissions", permissions)
						}

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

// PermissionMiddleware 权限检查中间件
func PermissionMiddleware(requiredPermission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		adminRole, roleExists := c.Get("admin_role")
		if !roleExists {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "请登录后操作"})
			c.Abort()
			return
		}

		// 超级管理员拥有所有权限
		if adminRole.(string) == "super" {
			c.Next()
			return
		}

		// 检查普通管理员的权限
		permissions, permExists := c.Get("admin_permissions")
		if !permExists {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "权限不足"})
			c.Abort()
			return
		}

		permStr := permissions.(string)
		// 检查是否有 all 权限或包含所需权限
		if permStr == "all" || contains(permStr, requiredPermission) {
			c.Next()
			return
		}

		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "权限不足，无法执行此操作"})
		c.Abort()
	}
}

// contains 检查逗号分隔的字符串中是否包含指定值
func contains(permStr, target string) bool {
	if permStr == "" {
		return false
	}
	perms := strings.Split(permStr, ",")
	for _, p := range perms {
		if strings.TrimSpace(p) == target {
			return true
		}
	}
	return false
}

// UserAuthMiddleware 用户认证中间件
func UserAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
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
						// 确保是用户 Token 而不是管理员 Token (管理员 Token 有 role)
						if _, hasRole := claims["role"]; !hasRole {
							c.Set("user_id", int(claims["id"].(float64)))
							c.Set("user_email", claims["email"].(string))
							c.Next()
							return
						}
					}
				}
			}
		}

		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "请登录后操作"})
		c.Abort()
	}
}

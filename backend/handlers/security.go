package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RobotsTxt 返回 robots.txt 内容
func RobotsTxt(c *gin.Context) {
	robotsTxt := `User-agent: *
Disallow: /

# 禁止所有搜索引擎收录整个网站
User-agent: Googlebot
Disallow: /

User-agent: Bingbot
Disallow: /

User-agent: Baiduspider
Disallow: /

User-agent: Yandex
Disallow: /

User-agent: Sogou
Disallow: /
`
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet")
	c.String(http.StatusOK, robotsTxt)
}

// SecurityTxt 返回 security.txt 内容（安全联系信息）
func SecurityTxt(c *gin.Context) {
	securityTxt := `Contact: mailto:admin@sstfreya.top
Expires: 2025-12-31T23:59:59.000Z
Preferred-Languages: zh-CN, en
`
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, securityTxt)
}

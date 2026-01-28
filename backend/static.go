package main

import (
	"embed"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:embed dist/*
var staticFiles embed.FS

func ServeStatic(r *gin.Engine) {
	subFS, err := fs.Sub(staticFiles, "dist")
	if err != nil {
		panic(err)
	}

	// 1. 处理根路径直接返回 index.html 内容
	r.GET("/", func(c *gin.Context) {
		serveIndex(c, subFS)
	})

	// 2. 处理静态资源文件
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// API 请求不处理
		if strings.HasPrefix(path, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"message": "API route not found"})
			return
		}

		// 移除开头的斜杠
		filePath := strings.TrimPrefix(path, "/")

		// 尝试从 FS 中打开文件
		f, err := subFS.Open(filePath)
		if err != nil {
			// 如果包含点（如 .js, .css），说明是请求资源但没找到，直接 404
			if strings.Contains(filepath.Base(path), ".") {
				c.Status(http.StatusNotFound)
				return
			}
			// 否则可能是前端路由，返回 index.html
			serveIndex(c, subFS)
			return
		}
		defer f.Close()

		// 检查是否是目录
		stat, err := f.Stat()
		if err != nil || stat.IsDir() {
			serveIndex(c, subFS)
			return
		}

		// 获取文件内容并发送，不使用 http.FileServer 避免重定向
		content, err := io.ReadAll(f)
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}

		// 根据后缀设置 Content-Type
		contentType := mime.TypeByExtension(filepath.Ext(filePath))
		if contentType == "" {
			contentType = "application/octet-stream"
		}

		c.Data(http.StatusOK, contentType, content)
	})
}

// serveIndex 专门用于发送 index.html 的内容
func serveIndex(c *gin.Context, subFS fs.FS) {
	f, err := subFS.Open("index.html")
	if err != nil {
		c.String(http.StatusNotFound, "index.html not found")
		return
	}
	defer f.Close()

	content, err := io.ReadAll(f)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	// 显式设置状态码为 200，并指定内容类型，防止任何自动重定向
	c.Data(http.StatusOK, "text/html; charset=utf-8", content)
}

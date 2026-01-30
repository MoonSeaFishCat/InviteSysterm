#!/bin/bash

# 邀请码分发系统 - 构建脚本
# 支持多平台构建

echo "🚀 开始构建邀请码分发系统..."

# 设置版本号
VERSION="2.0.0"
BUILD_TIME=$(date +"%Y-%m-%d %H:%M:%S")

# 创建构建目录
mkdir -p dist

echo ""
echo "📦 构建 Linux AMD64 版本..."
GOOS=linux GOARCH=amd64 go build -ldflags "-s -w -X 'main.Version=$VERSION' -X 'main.BuildTime=$BUILD_TIME'" -o dist/invite-backend-linux-amd64 .
if [ $? -eq 0 ]; then
    echo "✅ Linux AMD64 构建成功: dist/invite-backend-linux-amd64"
else
    echo "❌ Linux AMD64 构建失败"
    exit 1
fi

echo ""
echo "📦 构建 Linux ARM64 版本..."
GOOS=linux GOARCH=arm64 go build -ldflags "-s -w -X 'main.Version=$VERSION' -X 'main.BuildTime=$BUILD_TIME'" -o dist/invite-backend-linux-arm64 .
if [ $? -eq 0 ]; then
    echo "✅ Linux ARM64 构建成功: dist/invite-backend-linux-arm64"
else
    echo "❌ Linux ARM64 构建失败"
fi

echo ""
echo "📦 构建 Windows AMD64 版本..."
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -X 'main.Version=$VERSION' -X 'main.BuildTime=$BUILD_TIME'" -o dist/invite-backend-windows-amd64.exe .
if [ $? -eq 0 ]; then
    echo "✅ Windows AMD64 构建成功: dist/invite-backend-windows-amd64.exe"
else
    echo "❌ Windows AMD64 构建失败"
fi

echo ""
echo "📦 构建 macOS AMD64 版本..."
GOOS=darwin GOARCH=amd64 go build -ldflags "-s -w -X 'main.Version=$VERSION' -X 'main.BuildTime=$BUILD_TIME'" -o dist/invite-backend-darwin-amd64 .
if [ $? -eq 0 ]; then
    echo "✅ macOS AMD64 构建成功: dist/invite-backend-darwin-amd64"
else
    echo "❌ macOS AMD64 构建失败"
fi

echo ""
echo "📦 构建 macOS ARM64 (Apple Silicon) 版本..."
GOOS=darwin GOARCH=arm64 go build -ldflags "-s -w -X 'main.Version=$VERSION' -X 'main.BuildTime=$BUILD_TIME'" -o dist/invite-backend-darwin-arm64 .
if [ $? -eq 0 ]; then
    echo "✅ macOS ARM64 构建成功: dist/invite-backend-darwin-arm64"
else
    echo "❌ macOS ARM64 构建失败"
fi

echo ""
echo "📊 构建结果："
ls -lh dist/

echo ""
echo "✨ 构建完成！"
echo ""
echo "使用方法："
echo "  Linux:   ./dist/invite-backend-linux-amd64"
echo "  Windows: .\\dist\\invite-backend-windows-amd64.exe"
echo "  macOS:   ./dist/invite-backend-darwin-amd64"


@echo off
REM 邀请码分发系统 - Windows 构建脚本
REM 支持多平台构建

echo 🚀 开始构建邀请码分发系统...
echo.

REM 设置版本号
set VERSION=2.0.0
set BUILD_TIME=%date% %time%

REM 创建构建目录
if not exist dist mkdir dist

echo 📦 构建 Linux AMD64 版本...
set GOOS=linux
set GOARCH=amd64
go build -ldflags "-s -w -X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" -o dist/invite-backend-linux-amd64 .
if %errorlevel% equ 0 (
    echo ✅ Linux AMD64 构建成功: dist/invite-backend-linux-amd64
) else (
    echo ❌ Linux AMD64 构建失败
    exit /b 1
)
echo.

echo 📦 构建 Linux ARM64 版本...
set GOOS=linux
set GOARCH=arm64
go build -ldflags "-s -w -X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" -o dist/invite-backend-linux-arm64 .
if %errorlevel% equ 0 (
    echo ✅ Linux ARM64 构建成功: dist/invite-backend-linux-arm64
) else (
    echo ❌ Linux ARM64 构建失败
)
echo.

echo 📦 构建 Windows AMD64 版本...
set GOOS=windows
set GOARCH=amd64
go build -ldflags "-s -w -X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" -o dist/invite-backend-windows-amd64.exe .
if %errorlevel% equ 0 (
    echo ✅ Windows AMD64 构建成功: dist/invite-backend-windows-amd64.exe
) else (
    echo ❌ Windows AMD64 构建失败
)
echo.

echo 📦 构建 macOS AMD64 版本...
set GOOS=darwin
set GOARCH=amd64
go build -ldflags "-s -w -X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" -o dist/invite-backend-darwin-amd64 .
if %errorlevel% equ 0 (
    echo ✅ macOS AMD64 构建成功: dist/invite-backend-darwin-amd64
) else (
    echo ❌ macOS AMD64 构建失败
)
echo.

echo 📦 构建 macOS ARM64 (Apple Silicon) 版本...
set GOOS=darwin
set GOARCH=arm64
go build -ldflags "-s -w -X 'main.Version=%VERSION%' -X 'main.BuildTime=%BUILD_TIME%'" -o dist/invite-backend-darwin-arm64 .
if %errorlevel% equ 0 (
    echo ✅ macOS ARM64 构建成功: dist/invite-backend-darwin-arm64
) else (
    echo ❌ macOS ARM64 构建失败
)
echo.

echo 📊 构建结果：
dir dist /b
echo.

echo ✨ 构建完成！
echo.
echo 使用方法：
echo   Linux:   ./dist/invite-backend-linux-amd64
echo   Windows: .\dist\invite-backend-windows-amd64.exe
echo   macOS:   ./dist/invite-backend-darwin-amd64
echo.

pause


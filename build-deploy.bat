@echo off
chcp 65001 >nul
echo 🚀 开始构建部署包...
echo.

REM 1. 清理旧的构建文件
echo 🧹 清理旧的构建文件...
if exist .next rmdir /s /q .next
if exist out rmdir /s /q out

REM 2. 安装依赖
echo 📦 安装依赖...
call pnpm install

REM 3. 构建生产版本
echo 🏗️  构建生产版本...
call pnpm build

REM 4. 初始化数据库
echo 💾 初始化数据库...
call npx tsx src/db/init.ts

REM 5. 创建部署包目录
echo 📦 创建部署包...
set DEPLOY_DIR=deploy-package
if exist %DEPLOY_DIR% rmdir /s /q %DEPLOY_DIR%
mkdir %DEPLOY_DIR%

REM 6. 复制必要文件
echo 📋 复制文件...
xcopy .next %DEPLOY_DIR%\.next\ /E /I /Q
xcopy public %DEPLOY_DIR%\public\ /E /I /Q
xcopy node_modules %DEPLOY_DIR%\node_modules\ /E /I /Q
copy package.json %DEPLOY_DIR%\
copy next.config.ts %DEPLOY_DIR%\
copy tsconfig.json %DEPLOY_DIR%\
copy invite.db %DEPLOY_DIR%\ 2>nul

REM 7. 创建启动脚本
echo 🔧 创建启动脚本...
(
echo @echo off
echo chcp 65001 ^>nul
echo echo 🚀 启动 L站邀请码系统...
echo npm start
) > %DEPLOY_DIR%\start.bat

REM 8. 创建说明文件
(
echo # 部署说明
echo.
echo ## 上传到服务器后的操作：
echo.
echo ### Linux 服务器：
echo ```bash
echo # 1. 安装依赖
echo pnpm install
echo.
echo # 2. 启动服务
echo pnpm start
echo.
echo # 或使用 PM2
echo pm2 start "pnpm start" --name invite-system
echo ```
echo.
echo ### Windows 服务器：
echo 直接双击 start.bat 启动
echo.
echo ## 环境要求：
echo - Node.js 18+
echo - pnpm ^(或 npm^)
echo.
echo ## 注意事项：
echo 1. 使用纯 JavaScript 数据库驱动，无需编译，跨平台兼容
echo 2. 首次启动后立即修改默认管理员密码
echo 3. 配置环境变量 ^(.env.local^)
echo 4. 客户端访问时需清除浏览器缓存
) > %DEPLOY_DIR%\部署说明.txt

echo.
echo ✅ 部署包已创建在 %DEPLOY_DIR% 目录
echo.
echo 📝 下一步：
echo   1. 将 %DEPLOY_DIR% 目录上传到服务器
echo   2. 在服务器上安装依赖: pnpm install
echo   3. 启动服务: pnpm start
echo.
pause

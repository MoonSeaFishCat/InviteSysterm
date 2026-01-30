# 🌸 小汐の邀请码申请系统

<div align="center">

![License](https://img.shields.io/badge/license-AGPLv3-blue.svg)
![Go Version](https://img.shields.io/badge/Go-1.24+-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Security](https://img.shields.io/badge/Security-Enhanced-green)

一个简洁、安全且美观的邀请码申请与分发系统

[功能特点](#功能特点) • [技术栈](#技术栈) • [快速开始](#快速开始) • [安全性](#安全性) • [部署指南](#部署指南)

</div>

---

## 📖 项目简介

欢迎来到小汐的邀请码申请系统！本项目旨在为私有社区提供一个自动化、安全、易用的邀请码申请与审核流程。

> **提示：** 欢迎来到小汐的邀请码申请系统，请认真填写您的申请理由，我们将用心审核每一份申请。
> PS：小汐也不知道项目会运行多久 一切随缘（确信）大概率应该是小汐跌出三级？

---

## ✨ 功能特点

### 🎨 用户体验
- **响应式 UI**：基于 React + HeroUI + Tailwind CSS 构建
- **暗黑模式**：支持明暗主题切换
- **流畅动效**：使用 Framer Motion 打造极致体验
- **治愈系设计**：精美的邮件模板和界面设计

### 🔐 安全保障
- **🔑 动态密钥管理**：
  - 启动时自动生成 32 字节随机密钥
  - 每 24 小时自动轮换密钥
  - 支持密钥轮换期间的平滑过渡
- **🛡️ 星月御安全系统**：
  - Payload 加密传输（7 轮混淆算法）
  - 设备指纹校验
  - 时间戳验证（10 分钟有效期）
  - Nonce 防重放攻击
- **🤖 人机验证**：集成极验 4.0 Captcha
- **📧 邮箱验证**：SMTP 验证码 + 密码重置功能
- **🚫 风控系统**：
  - IP/设备/邮箱黑名单
  - 邮箱白名单
  - 申请频率限制
  - 速率限制（60 req/min）

### 👥 用户功能
- **账户系统**：注册、登录、个人中心
- **密码管理**：修改密码、忘记密码（邮箱重置）
- **申请管理**：提交申请、查看申请状态、获取邀请码
- **工单系统**：提交工单、实时沟通
- **站内信**：接收系统通知

### 🔧 管理端
- **申请管理**：
  - 集中审核界面
  - 批量操作（批量审核、批量删除）
  - 审核意见与备注
  - 自动邮件通知
- **用户管理**：
  - 用户列表与详情
  - 账户状态管理（启用/禁用）
  - 密码重置
  - 用户删除
- **黑名单管理**：
  - 邮箱/设备/IP 黑名单
  - 黑名单原因记录
  - 批量导入导出
- **系统配置**：
  - 站点名称与公告
  - SMTP 邮件服务
  - 邮箱白名单
  - 极验验证码配置
  - 风控参数调整
- **审计日志**：完整的操作记录
- **管理员管理**：多管理员、角色权限控制

---

## 🛠️ 技术栈

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **UI 库**：HeroUI (NextUI)
- **样式**：Tailwind CSS
- **动画**：Framer Motion
- **图标**：React Icons
- **路由**：React Router v6
- **HTTP 客户端**：Axios
- **通知**：React Hot Toast

### 后端
- **语言**：Go 1.24+
- **框架**：Gin
- **数据库**：SQLite (modernc.org/sqlite)
- **认证**：JWT (golang-jwt/jwt)
- **邮件**：gomail.v2
- **配置**：godotenv

### 安全
- **加密算法**：自定义 7 轮混淆加密
- **密钥管理**：自动生成 + 定期轮换
- **密码哈希**：SHA256（建议升级到 bcrypt）
- **防护机制**：SQL 注入防护、XSS 防护、CSRF 防护、速率限制

---

## 🚀 快速开始

### 环境要求

- **Go**: 1.24 或更高版本
- **Node.js**: 16+ 或更高版本
- **npm/yarn**: 最新版本

### 后端部署

1. **进入后端目录**
   ```bash
   cd backend
   ```

2. **安装依赖**
   ```bash
   go mod download
   ```

3. **配置环境变量**

   复制 `.env.example` 为 `.env` 并配置：
   ```bash
   cp .env.example .env
   ```

   编辑 `.env` 文件：
   ```env
   # 服务器配置
   PORT=8080
   GIN_MODE=release  # 生产环境使用 release
   DB_PATH=./invite.db

   # JWT 密钥（必须修改为强随机密钥）
   JWT_SECRET=your-super-secret-jwt-key-at-least-32-bytes

   # 管理员账户（首次启动时创建）
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-strong-password

   # SMTP 邮件配置
   SMTP_HOST=smtp.example.com
   SMTP_PORT=465
   SMTP_USER=noreply@example.com
   SMTP_PASS=your-email-password
   ```

   **生成强密钥：**
   ```bash
   # 生成 JWT Secret
   openssl rand -base64 32

   # 生成管理员密码
   openssl rand -base64 16
   ```

4. **运行后端**
   ```bash
   go run main.go
   ```

   或编译后运行：
   ```bash
   go build -o invite-backend
   ./invite-backend
   ```

### 前端部署

1. **进入前端目录**
   ```bash
   cd frontend
   ```

2. **安装依赖**
   ```bash
   npm install
   # 或使用 yarn
   yarn install
   ```

3. **配置 API 地址**

   编辑 `src/api/client.ts`，修改 `baseURL`：
   ```typescript
   const api = axios.create({
     baseURL: 'http://your-domain.com/api',  // 修改为你的后端地址
     timeout: 10000,
   });
   ```

4. **开发模式运行**
   ```bash
   npm run dev
   ```

5. **生产构建**
   ```bash
   npm run build
   ```

   构建产物在 `dist` 目录，可以部署到任何静态服务器。

---

## 🔒 安全性

本系统经过全面的安全审计，实现了多层安全防护：

### 已实现的安全特性

✅ **SQL 注入防护**：所有查询使用参数化语句
✅ **XSS 防护**：React 自动转义 + 后端验证
✅ **CSRF 防护**：自定义加密方案 + 时间戳验证
✅ **密钥管理**：自动生成 + 24 小时轮换
✅ **密码重置**：安全的邮箱验证流程
✅ **速率限制**：全局 + 业务级限制
✅ **黑名单系统**：IP/设备/邮箱多维度防护
✅ **审计日志**：完整的操作记录
✅ **JWT 认证**：Token 过期 + 角色权限控制

### 安全建议

⚠️ **生产环境必须配置：**
- 设置强随机 `JWT_SECRET`（至少 32 字节）
- 启用 HTTPS（配置 SSL 证书）
- 设置 `GIN_MODE=release`
- 配置防火墙和反向代理
- 定期备份数据库

⚠️ **推荐改进：**
- 升级密码哈希算法到 bcrypt
- 添加 CSRF Token
- 实现 Token 刷新机制
- 添加更多日志和监控

详细安全审计报告请查看：[SECURITY_AUDIT.md](SECURITY_AUDIT.md)

---

## 📦 部署指南

### 使用 Docker（推荐）

```bash
# 构建镜像
docker build -t invite-system .

# 运行容器
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -e JWT_SECRET=your-secret \
  -e ADMIN_PASSWORD=your-password \
  --name invite-system \
  invite-system
```

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 使用 Systemd 服务

创建 `/etc/systemd/system/invite-backend.service`：

```ini
[Unit]
Description=Invite System Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend
ExecStart=/path/to/backend/invite-backend
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable invite-backend
sudo systemctl start invite-backend
```

---

## 📂 项目结构

```
邀请码分发/
├── backend/                 # 后端 Go 代码
│   ├── config/             # 配置管理
│   ├── database/           # 数据库初始化
│   ├── handlers/           # API 处理器
│   │   ├── admin.go       # 管理员接口
│   │   ├── application.go # 申请管理
│   │   ├── user.go        # 用户接口
│   │   ├── password_reset.go  # 密码重置
│   │   └── security_key.go    # 密钥接口
│   ├── middleware/         # 中间件
│   │   ├── auth.go        # 认证中间件
│   │   └── rate_limit.go  # 速率限制
│   ├── models/            # 数据模型
│   ├── services/          # 业务服务
│   │   └── email.go       # 邮件服务
│   ├── utils/             # 工具函数
│   │   ├── security.go    # 加密解密
│   │   └── key_manager.go # 密钥管理器 ⭐
│   ├── main.go            # 入口文件
│   └── go.mod             # Go 依赖
│
├── frontend/               # 前端 React 代码
│   ├── src/
│   │   ├── api/           # API 客户端
│   │   ├── components/    # 公共组件
│   │   ├── pages/         # 页面组件
│   │   │   ├── UserLogin.tsx
│   │   │   ├── UserRegister.tsx
│   │   │   ├── ForgotPassword.tsx  # 忘记密码 ⭐
│   │   │   ├── ResetPassword.tsx   # 重置密码 ⭐
│   │   │   └── ...
│   │   ├── utils/         # 工具函数
│   │   │   └── security.ts  # 前端加密（动态密钥）⭐
│   │   ├── App.tsx        # 应用入口
│   │   └── main.tsx       # 主入口
│   ├── package.json       # npm 依赖
│   └── vite.config.ts     # Vite 配置
│
├── README.md              # 项目说明
├── SECURITY_AUDIT.md      # 安全审计报告 ⭐
└── LICENSE                # 开源协议

⭐ 标记为本次更新的重点文件
```

---

## 🔑 密钥管理系统

本系统实现了自动化的密钥管理机制，无需手动配置加密密钥。

### 工作原理

1. **自动生成**：后端启动时自动生成 32 字节随机密钥
2. **定期轮换**：每 24 小时自动轮换密钥
3. **平滑过渡**：保留上一个密钥用于解密旧请求
4. **前端同步**：前端自动从服务器获取当前密钥（23 小时缓存）

### 密钥生成流程

```go
// 1. 生成 32 字节随机数
keyBytes := make([]byte, 32)
rand.Read(keyBytes)

// 2. Base64 编码
key := base64.StdEncoding.EncodeToString(keyBytes)

// 3. 7 轮混淆
for i := 0; i < 7; i++ {
    key = base64.StdEncoding.EncodeToString([]byte(key))
    if len(key) > 32 {
        key = key[:32]
    }
}
```

### 密钥轮换

- **轮换周期**：24 小时
- **兼容性**：轮换后 1 小时内，新旧密钥同时有效
- **前端缓存**：23 小时（比服务器轮换周期短 1 小时）
- **自动重试**：解密失败时自动尝试旧密钥

---

## 🔐 密码重置功能

新增了安全的密码重置功能，用户可以通过邮箱重置忘记的密码。

### 功能特点

✅ **安全令牌**：32 字节随机生成
✅ **有效期限制**：30 分钟内有效
✅ **一次性使用**：令牌使用后立即失效
✅ **防枚举攻击**：统一返回消息，不泄露邮箱是否存在
✅ **频率限制**：60 秒内只能请求一次
✅ **邮件通知**：精美的 HTML 邮件模板

### 使用流程

1. 用户点击"忘记密码"
2. 输入注册邮箱
3. 系统发送重置链接到邮箱
4. 用户点击链接，设置新密码
5. 密码重置成功，自动跳转登录

---

## 🎯 API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 获取统计信息 |
| GET | `/api/security/key` | 获取加密密钥 ⭐ |
| POST | `/api/verification-code` | 发送验证码 |
| POST | `/api/register-code` | 发送注册验证码 |
| GET | `/api/captcha` | 获取验证码 |
| POST | `/api/password/request-reset` | 请求密码重置 ⭐ |
| GET | `/api/password/verify-token` | 验证重置令牌 ⭐ |
| POST | `/api/password/reset` | 重置密码 ⭐ |

### 用户接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/user/register` | 用户注册 |
| POST | `/api/user/login` | 用户登录 |
| GET | `/api/user/profile` | 获取个人信息 |
| PUT | `/api/user/profile` | 更新个人信息 |
| POST | `/api/user/change-password` | 修改密码 |
| POST | `/api/application/submit` | 提交申请 |
| GET | `/api/application/my` | 我的申请 |

### 管理员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/login` | 管理员登录 |
| GET | `/api/admin/applications` | 申请列表 |
| POST | `/api/admin/applications/:id/approve` | 审核通过 |
| POST | `/api/admin/applications/:id/reject` | 审核拒绝 |
| GET | `/api/admin/users` | 用户列表 |
| DELETE | `/api/admin/users/:id` | 删除用户 |
| GET | `/api/admin/blacklist` | 黑名单列表 |
| POST | `/api/admin/blacklist` | 添加黑名单 |
| GET | `/api/admin/config` | 获取配置 |
| PUT | `/api/admin/config` | 更新配置 |

---

## 🐛 常见问题

### 1. 后端启动失败

**问题**：`Failed to initialize database`

**解决**：
- 检查 `DB_PATH` 配置是否正确
- 确保目录有写入权限
- 删除旧的数据库文件重新初始化

### 2. 邮件发送失败

**问题**：`SMTP authentication failed`

**解决**：
- 检查 SMTP 配置是否正确
- 确认邮箱密码（可能需要使用应用专用密码）
- 检查 SMTP 端口（465 使用 SSL，587 使用 TLS）

### 3. 前端无法连接后端

**问题**：`Network Error` 或 `CORS Error`

**解决**：
- 检查后端是否正常运行
- 确认 API 地址配置正确
- 检查 CORS 配置（后端已配置，通常不需要修改）

### 4. 密钥获取失败

**问题**：`无法获取加密密钥`

**解决**：
- 确保后端 `/api/security/key` 接口可访问
- 检查网络连接
- 清除浏览器缓存重试

### 5. Token 过期

**问题**：`Token expired` 或 `Unauthorized`

**解决**：
- 重新登录获取新 Token
- 检查系统时间是否正确
- 确认 JWT_SECRET 配置一致

---

## 📝 更新日志

### v2.0.0 (2024-01)

**🔐 安全增强**
- ✅ 实现自动密钥生成和轮换机制
- ✅ 新增密码重置功能（邮箱验证）
- ✅ 完成全面安全审计
- ✅ 修复加密密钥硬编码问题

**🎨 功能改进**
- ✅ 优化前端加密逻辑（动态获取密钥）
- ✅ 改进邮件模板设计
- ✅ 增强错误处理和用户提示

**📚 文档更新**
- ✅ 完善 README.md
- ✅ 新增安全审计报告
- ✅ 添加部署指南

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- **Go**: 遵循 Go 官方代码规范，使用 `gofmt` 格式化
- **TypeScript**: 遵循 ESLint 配置，使用 Prettier 格式化
- **提交信息**: 使用语义化提交信息（Conventional Commits）

---

## 📄 许可证

本项目采用 [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE) 协议开源。

这意味着：
- ✅ 可以自由使用、修改和分发
- ✅ 必须开源修改后的代码
- ✅ 必须保留原作者版权信息
- ⚠️ 网络服务也必须开源（AGPL 特性）

---

## 💖 致谢

感谢所有为本项目做出贡献的开发者！

特别感谢：
- [Gin](https://github.com/gin-gonic/gin) - 高性能 Go Web 框架
- [React](https://react.dev/) - 用户界面库
- [NextUI](https://nextui.org/) - 现代化 UI 组件库
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架

---

## 📧 联系方式

- **项目主页**: [GitHub Repository](https://github.com/yourusername/invite-system)
- **问题反馈**: [Issues](https://github.com/yourusername/invite-system/issues)
- **邮箱**: your-email@example.com

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给一个 Star！⭐**

Made with ❤️ by 小汐

</div>

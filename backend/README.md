# L站邀请码分发系统 - 后端

基于 Go + Gin + SQLite 的后端服务。

## 快速开始

### 1. 安装依赖

```bash
go mod download
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

### 3. 运行服务

```bash
go run main.go
```

服务将在 `http://localhost:8080` 启动。

## 功能特性

- ✅ 邀请码申请与审核
- ✅ 邮箱验证码验证
- ✅ 星月御安全加密系统
- ✅ 设备指纹风控
- ✅ 管理员后台
- ✅ SMTP 邮件发送
- ✅ SQLite 数据存储

## API 接口

### 公开接口

- `GET /api/stats` - 获取统计信息
- `POST /api/verification-code` - 发送验证码
- `GET /api/captcha` - 获取验证码问题
- `GET /api/security-challenge` - 获取 PoW 挑战
- `POST /api/application/submit` - 提交申请
- `POST /api/application/status` - 检查申请状态

### 管理员接口

- `POST /api/admin/login` - 管理员登录
- `POST /api/admin/logout` - 管理员登出
- `GET /api/admin/applications` - 获取所有申请
- `POST /api/admin/review` - 审核申请
- `GET /api/admin/settings` - 获取系统设置
- `POST /api/admin/settings/update` - 更新系统设置
- `POST /api/admin/change-password` - 修改管理员密码

## 默认管理员密码

用户名：admin
密码：admin

**请在首次登录后立即修改密码！**

## 目录结构

```
backend/
├── config/         # 配置管理
├── database/       # 数据库初始化
├── handlers/       # HTTP 处理器
├── middleware/     # 中间件
├── models/         # 数据模型
├── services/       # 业务服务
├── utils/          # 工具函数
└── main.go         # 入口文件
```

## 部署

### 编译

```bash
go build -o invite-backend
```

### 运行

```bash
./invite-backend
```

## License

MIT

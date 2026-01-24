# L站邀请码分发系统 (Healing Invite System)

一款基于 Next.js + HeroUI 的温馨治愈系邀请码申请与分发系统。专为社区邀请制设计，集成了高强度的安全防护与风控逻辑。

## ✨ 特性

- **🎨 温馨治愈 UI**: 采用柔和的配色方案与模糊背景设计，提供宁静的视觉体验。
- **🛡️ 星月御安全 (Star-Moon Shield Security)**:
  - **7星级魔改加密**: 自研多轮异或、位移与置换混淆算法，API 传输全加密。
  - **动态 PoW 校验**: 提交申请需完成 SHA-256 算力挑战，有效阻断自动化脚本。
  - **深度设备指纹**: 集成 Canvas、WebGL、Audio、Fonts 等多维硬件特征采集，实现精准风控。
- **⚙️ 管理员后台**:
  - **仪表盘**: 实时统计申请状态。
  - **审核管理**: 支持手动输入邀请码，自动发送邮件通知（通过/拒绝）。
  - **系统设置**: 动态配置 SMTP 邮件服务、邮箱白名单及风控阈值。
- **📦 极简部署**: 使用 SQLite 纯 JS 驱动（Better-SQLite3），无需复杂数据库配置。

## 🚀 技术栈

- **Frontend**: Next.js 15 (App Router), HeroUI (NextUI), Tailwind CSS, Lucide React
- **Backend**: Next.js Server Actions, Drizzle ORM
- **Database**: SQLite (via `better-sqlite3`)
- **Security**: Star-Moon Shield (Custom PoW + Encryption)
- **Email**: Nodemailer

## 🛠️ 快速开始

1. **克隆项目**:
   ```bash
   git clone <repository-url>
   cd l-invite
   ```

2. **安装依赖**:
   ```bash
   npm install
   ```

3. **配置环境变量**:
   在项目根目录创建 `.env` 文件：
   ```env
   ADMIN_PASSWORD=your_admin_password
   NEXT_PUBLIC_SECURITY_KEY=your_random_security_key
   ```

4. **初始化数据库**:
   ```bash
   npm run db:init
   ```

5. **启动开发服务器**:
   ```bash
   npm run dev
   ```

6. **访问**:
   - 申请页面: `http://localhost:3000`
   - 管理后台: `http://localhost:3000/admin`

## ⚖️ 开源协议

本项目采用 **AGPL-3.0** 协议开源。

> **注意**: 申请理由可用于后续 L 站的正式注册理由，系统相当于进行一次初审。

---
由 **星月御安全** 强力驱动 🌙⭐

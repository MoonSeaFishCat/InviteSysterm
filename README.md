# 小汐の邀请码申请系统

一个简洁、安全且美观的邀请码申请与分发系统。

## 项目简介

欢迎来到小汐的邀请码申请系统！本项目旨在为私有社区提供一个自动化的邀请码申请流程。

> **提示：** 欢迎来到小汐的邀请码申请系统，请认真填写您的申请理由，我们将用心审核每一份申请。  
> PS：小汐也不知道项目会运行多久 一切随缘（确信）大概率应该是小汐跌出三级？

## 功能特点

- **响应式 UI**：基于 React + HeroUI + Tailwind CSS 构建，支持暗黑模式，极致的动效体验。
- **安全保障**：
  - **人机验证 (Captcha)**：防止自动化脚本攻击。
  - **星月御安全**：集成 Payload 加密传输与设备指纹校验，防止暴力破解与重放攻击。
  - **邮箱验证**：通过 SMTP 发送验证码，确保用户真实性。
  - **风控系统**：支持单设备/单邮箱申请上限配置。
- **管理端**：
  - **申请管理**：集中的详情展示与快速审核流程。
  - **系统公告**：支持发布、隐藏与删除全站公告。
  - **配置中心**：动态修改站点名称、SMTP 服务、白名单、注册审核开关等。
  - **账户管理**：支持修改管理员用户名与密码，增强安全性。

## 技术栈

- **前端**：React 18, Vite, HeroUI (NextUI), Tailwind CSS, React Icons, Framer Motion.
- **后端**：Go, Gin Framework, SQLite (GORM), JWT Authentication.
- **安全**：AES + Nonce + Device Fingerprint (StarMoonSecurity).

## 快速开始

### 后端 (Go)

1. 进入 `backend` 目录。
2. 复制 `.env.example` 为 `.env` 并配置。
3. 运行 `go run main.go`。

### 前端 (React)

1. 进入 `frontend` 目录。
2. 运行 `npm install`。
3. 运行 `npm run dev`。

## 许可证

本项目采用 [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE) 协议开源。

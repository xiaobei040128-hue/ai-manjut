# AI CREATOR

当前正式平台：https://aicreatorai.com/

2026-11-13 已核对当前生产版本 **b530dacbfceb**，构建时间 **2026-11-09T08:00:34.960Z**。本仓库当前源码直接提取自生产服务器，并包含 2026-11-10 发布的十种语言「关于我们」和「平台交易与使用规则」页面。当前交接说明见 [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)。

## 安装与运行

需要 Node.js 24+。执行 `npm ci` 安装依赖；开发运行 `npm run dev`；生产执行 `npm run build` 后运行 `npm start`。前台 `/?view=app`，后台 `/admin.html`。配置以 `.env.example` 为模板。升级时保留原有 `DRAMA_DATA_DIR`、数据库、账本、上传文件、会话和密钥。

## 验证

移动运行时完整性检查 28 项通过；当前业务测试 78 项通过；在含实际构建产物的服务器隔离测试环境运行当前 HTTP/API 检查 10 项通过。20 个公开语言页面与本次提取的正文及导航一致。测试使用隔离数据，不代表真实付款或所有设备验收。

`npm test` 包含业务及 HTTP/API 检查，后者需要先生成生产构建。构建使用 `npm run build` 保留旧哈希资源兼容；不要绕过该流程直接使用 `build:bundle`。

## 数据与退休项目

仓库不包含运行数据库、客户上传文件、私有 `.env`、凭据、密钥、`node_modules` 或 `dist`。`RELEASE-MANIFEST.json` 记录此次核对的线上构建信息；重新构建会生成新的构建信息。

独立落地页 `datevera.date` 已停用并备份，容器、数据卷、路由服务和自启动已移除，公开入口返回 HTTP 410。Cloudflare DNS 记录及注册商域名尚未移除。

# AI CREATOR

当前正式平台：https://aicreatorai.com/

2026-11-13 已核对当前生产版本 **477de8c4c0ba**，构建时间 **2026-11-13T05:46:55.276Z**。本仓库基于当前生产源码整理，并已清理确认弃用的旧流程代码，并包含 2026-11-10 发布的十种语言「关于我们」和「平台交易与使用规则」页面。当前交接说明见 [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md)。

## 安装与运行

需要 Node.js 24+。执行 `npm ci` 安装依赖；开发运行 `npm run dev`；生产执行 `npm run build` 后运行 `npm start`。前台 `/?view=app`，后台 `/admin.html`。配置以 `.env.example` 为模板。升级时保留原有 `DRAMA_DATA_DIR`、数据库、账本、上传文件、会话和密钥。

## 验证

移动运行时完整性检查 28 项通过；当前业务测试 78 项通过；在含实际构建产物的服务器隔离测试环境运行当前 HTTP/API 检查 10 项通过。20 个公开语言页面与本次提取的正文及导航一致。测试使用隔离数据，不代表真实付款或所有设备验收。

`npm test` 包含业务及 HTTP/API 检查，后者需要先生成生产构建。构建使用 `npm run build` 保留旧哈希资源兼容；不要绕过该流程直接使用 `build:bundle`。

## 数据与退休项目

仓库不包含运行数据库、客户上传文件、私有 `.env`、凭据、密钥、`node_modules` 或 `dist`。`RELEASE-MANIFEST.json` 记录此次核对的线上构建信息；重新构建会生成新的构建信息。

独立落地页 `datevera.date` 已停用并备份，容器、数据卷、路由服务和自启动已移除，公开入口返回 HTTP 410。Cloudflare DNS 记录及注册商域名尚未移除。

2026-11-13 更新：主页链接预览标题、简介及 Open Graph/Twitter 元数据统一英语；中文语言标记和选项显示使用 zh-CN，旧 zh-SG 浏览器选择自动兼容迁移。

## 当前业务入口与历史兼容

当前客户端入口是 src/main.tsx → App.tsx → Prototype.tsx；任务页 StageWork.tsx 只渲染 TaskExperience.tsx。当前任务是第三阶段的每轮50项，按客户当前配置报价；服务端入口为 /api/stage-finance，核心实现见 server/third-plan.mjs、stage-dispatch.mjs、plan-dispatch.mjs 和 third-copyright.mjs。旧阶段1/2的领取与提交接口已停用，不能用旧新手流程说明当前业务。

已从当前分支删除未引用的新手/第二阶段页面、组件、样式、旧集成测试及已失效测试命令，并删除被提前拒绝挡住的旧提交代码和旧奖励/购买/结算实现。保留的早期金额、表结构和读取逻辑仅用于兼容已有历史订单与账本，不是当前订单报价规则；后台旧阶段配置写入也返回410。历史数据库与金额不做重写。

本次为仓库清理提交，正式平台运行文件未替换；前端构建产物与线上仍一致，客户数据未操作。

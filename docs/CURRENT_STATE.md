# AI CREATOR 当前生产基准

核对日期：2026-11-13（Asia/Shanghai）。

当前正式平台：https://aicreatorai.com/ 。服务器 /www/wwwroot/ai-manjut，端口4173。线上及公开 release-meta.json 一致：buildId 477de8c4c0ba，builtAt 2026-11-13T05:46:55.276Z。

仓库以当前生产源码为基准，另包含已验证的弃用代码清理。关于我们和平台规则的十种语言页面包含2026-11-10线上更新。RELEASE-MANIFEST.json仅记录生产构建，未重新发布。

构建：npm ci 后 npm run build；检查：npm test。部署保留原有 DRAMA_DATA_DIR、数据库、账本、上传文件、会话和密钥。仓库不包含这些生产私有数据、node_modules、dist或临时文件。

已退休落地页：datevera.date，LinkStack独立容器和datevera-routing服务已停用并从活动项目移除，公开入口410；备份位于服务器 /www/backup/datevera-retired-20261113。Cloudflare DNS记录及注册商域名状态尚未清理，需账户访问。

旧docs/archive和聊天只用于追溯；当前生产源码及用户最新指示优先。

2026-11-13 更新：主页链接预览标题、简介及 Open Graph/Twitter 元数据统一英语；中文语言标记和选项显示使用 zh-CN，旧 zh-SG 浏览器选择自动兼容迁移。

## 当前业务入口与历史兼容

当前客户端入口是 src/main.tsx → App.tsx → Prototype.tsx；任务页 StageWork.tsx 只渲染 TaskExperience.tsx。当前任务是第三阶段的每轮50项，按客户当前配置报价；服务端入口为 /api/stage-finance，核心实现见 server/third-plan.mjs、stage-dispatch.mjs、plan-dispatch.mjs 和 third-copyright.mjs。旧阶段1/2的领取与提交接口已停用，不能用旧新手流程说明当前业务。

已从当前分支删除未引用的新手/第二阶段页面、组件、样式、旧集成测试及已失效测试命令，并删除被提前拒绝挡住的旧提交代码和旧奖励/购买/结算实现。保留的早期金额、表结构和读取逻辑仅用于兼容已有历史订单与账本，不是当前订单报价规则；后台旧阶段配置写入也返回410。历史数据库与金额不做重写。

本次为仓库清理提交，正式平台运行文件未替换；前端构建产物与线上仍一致，客户数据未操作。

# AI CREATOR 当前生产基准

核对日期：2026-11-13（Asia/Shanghai）。

当前正式平台：https://aicreatorai.com/ 。服务器 /www/wwwroot/ai-manjut，端口4173。线上及公开 release-meta.json 一致：buildId b530dacbfceb，builtAt 2026-11-09T08:00:34.960Z。

本次源码直接提取自运行服务器，不以旧本地副本覆盖生产。关于我们和平台规则的十种语言页面包含2026-11-10线上更新。RELEASE-MANIFEST.json仅记录生产构建，未重新发布。

构建：npm ci 后 npm run build；检查：npm test。部署保留原有 DRAMA_DATA_DIR、数据库、账本、上传文件、会话和密钥。仓库不包含这些生产私有数据、node_modules、dist或临时文件。

已退休落地页：datevera.date，LinkStack独立容器和datevera-routing服务已停用并从活动项目移除，公开入口410；备份位于服务器 /www/backup/datevera-retired-20261113。Cloudflare DNS记录及注册商域名状态尚未清理，需账户访问。

旧docs/archive和聊天只用于追溯；当前生产源码及用户最新指示优先。

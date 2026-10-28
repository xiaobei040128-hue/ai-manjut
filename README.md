# AI CREATOR

Comic & Short Drama Platform

当前已交付版本：**2026-10-27，构建 `80ecfdc7515f`**。包含十种客户语言、钱包与动画修复、总后台删除代理账号、客户资料旧页面冲突校验。验证范围见 [最新版说明](docs/RELEASE-2026-10-27.md)。旧提交用于追溯，不是部署入口。

**当前产品规则和跨聊天交接以 [CURRENT_STATE.md](docs/CURRENT_STATE.md) 为准。** 旧版说明已归档，不能用旧ZIP或旧聊天恢复覆盖当前流程。

应用包含三阶段任务、版权码完成结算、客户独立档案、计划第1–5天普通/高阶报价配置、客户当地次日05:00开放，以及总后台/代理客户隔离。实际收付款仍需人工核实外部到账/出款。

## 运行

需要Node.js24+。npm ci 安装依赖；开发执行 npm run dev -- --port 4180；生产执行 npm run build 后 npm start。前台 /?view=app，后台 /admin.html。首次安装设置管理员；升级保留原DRAMA_DATA_DIR和finance.key，先通过后台备份。

## 检查与交付

npm test；npm run test:sites；npm run build。构建后的 /release-meta.json 标记buildId，交付包的RELEASE-MANIFEST.json标记提交和buildId。包不包含运行数据、登录会话、密钥、测试充值或node_modules。

公网配置见 [PRODUCTION.md](PRODUCTION.md)。当前交付与验证范围见 [最新版说明](docs/RELEASE-2026-10-27.md)。仓库按用户要求于2026-10-28重建，仅保留最新版快照。

# AI漫剧工作台

React 19、TypeScript、Vite 前端，Node.js HTTP 服务与 SQLite 数据库，包含创作者界面和管理后台。

三个阶段现已接入统一佣金比例、领取冻结本金、人工审核结算与钱包流水。首次注册成功发放一次 1 USD 新手奖励，不发布示例任务；后台先配置佣金比例，再发布各阶段任务。上线与运营步骤见 [PRODUCTION.md](PRODUCTION.md)。

## 本地运行

需要 Node.js 24 或以上及 npm。在项目目录执行：

```sh
npm ci
npm run build
npm start
```

创作者入口：http://localhost:4173/?view=app ，管理后台：http://localhost:4173/admin 。Windows 完成安装和构建后，也可以双击 `Start-Studio.cmd`。

首次启动需设置管理员账号，请在本机完成初始化后再考虑开放网络访问。

开发运行：`npm run dev`。默认监听 `127.0.0.1:4173`。可通过命令行 `--port`、`--host` 修改；数据目录由 `DRAMA_DATA_DIR` 指定，默认为 `runtime-data/`。

## 验证

```sh
npm test
npm run test:sites
npm run test:runtime
```

`test:runtime` 需要安装 Playwright 浏览器。API 测试使用本机 4181 端口，测试前需先构建。

## 数据与部署

仓库保存源码和静态素材，不保存依赖、构建产物、运行数据库、上传资料或加密密钥。`runtime-data/finance.key` 用于解密财务资料，必须与数据库一起安全备份。

Node.js 服务提供完整后端；`worker/index.js` 仅提供静态资源和前端路由回退，不能替代 Node.js/SQLite 业务接口。

旧版随机金额、计算器和模拟结算入口已经停用。当前收付款由后台人工核实外部转账，自动支付网关尚未选定。`CHECK_REPORT.md` 保留原包导入时的检查记录，当前资金流程与部署边界以 `PRODUCTION.md` 为准。

# 运行与部署

当前业务和权限以 docs/CURRENT_STATE.md 为准；本文仅说明部署。

## 本地与升级
- Node.js24+，npm ci，npm run build，npm start；默认127.0.0.1:4173。
- 开发预览 npm run dev -- --port 4180。不要同时把旧4175/4177目录当成最新版。
- 数据目录为DRAMA_DATA_DIR，默认runtime-data。升级前导出完整备份；数据库、uploads和finance.key一起保留。不要导入work中的测试数据。
- 首次安装在本机设置管理员，再生成邀请码；代理客户按邀请码归属隔离。真实充值核实到账后才审批，真实出款后才登记已付。

## 公网
- 必须使用Node.js24与持久磁盘，不能只发布静态Worker；每个工作区只运行一个业务实例。
- HTTPS反向代理，公网域名放入DRAMA_ALLOWED_HOSTS（逗号分隔，不含协议/端口），设置DRAMA_COOKIE_SECURE=1。
- 首次公开启动配置强随机DRAMA_SETUP_TOKEN；未初始化且无令牌时服务拒绝公开运行。
- 只有可信代理存在时启用DRAMA_TRUST_PROXY=1，并设置DRAMA_TRUST_PROXY_ADDRESSES。代理覆盖外部传入的X-Forwarded-For。
- 不提交.env、finance.key、数据库、证件和会话。副本环境必须使用独立数据目录。

## 版本一致性
- 源码更新后重新构建，完整替换同一dist/client，不混拷不同包的JS/CSS。
- /release-meta.json的buildId应与交付包RELEASE-MANIFEST.json一致。
- HTML、未哈希Logo与图片使用ETag重新校验；带内容哈希的JS/CSS可长期缓存。Service Worker按构建ID清理本应用旧缓存，资金与用户API从不缓存。
- 客户时区由手机IANA时区识别，刷新判断使用服务器时钟。当前计划日没完成不刷新；完成后等到完成日期次日当地05:00。夏令时由IANA时区处理，不使用固定UTC偏移。

本轮未部署公网、未接通自动收付款网关，也不声称已完成全部真机验收。

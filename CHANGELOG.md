# Changelog

## v1.1.0 (2025-11-19)

### 新增
- MCP 模式认证工具 `wechat_auth` 支持 `configure/get_token/refresh_token/get_config`
- CLI 版本号动态读取 `package.json`
- SSE 传输支持环境变量 `CORS_ORIGIN` 配置跨域来源

### 修复
- 修复 `wechat_media_upload` 在保存素材时未初始化数据库的问题，并统一创建时间为毫秒
- 修复 Express 错误处理中间件签名，确保被框架正确识别与捕获

### 安全
- 为 `app_secret/token/encoding_aes_key/access_token` 引入可选 AES 加密持久化（设置 `WECHAT_MCP_SECRET_KEY` 即启用）
- 微信 API 客户端错误日志脱敏：仅记录状态码或错误消息，避免泄露响应体
- CORS 来源可配置，建议生产环境设置白名单域名

### 改进
- 统一工具与客户端的错误日志输出格式，提升可读性与合规性

### 升级指南
- 强烈建议在生产环境配置：
  - `WECHAT_MCP_SECRET_KEY`：启用敏感字段加密存储
  - `CORS_ORIGIN`：逗号分隔白名单域名（如 `https://a.example.com,https://b.example.com`）
- 临时素材 `createdAt` 统一为毫秒时间戳，无需额外迁移；旧记录不受影响

---

## v1.0.3 (2025-11-19)
- 初始版本（发布至 npm，基础 MCP 工具与前端结构）
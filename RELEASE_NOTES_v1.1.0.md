# v1.1.0 发布说明

本次版本聚焦安全性、可用性与稳定性提升，完善了 MCP 模式认证能力，并修复素材上传时的数据库初始化问题。

## 重点特性
- MCP 认证工具可用：`wechat_auth` 支持配置、令牌获取/刷新与配置查看
- 可选加密存储：为配置与令牌引入 AES 加密（`WECHAT_MCP_SECRET_KEY`）
- CORS 白名单：`CORS_ORIGIN` 环境变量控制跨域来源（含 SSE 传输）
- CLI 版本号：动态读取 `package.json`，版本信息更准确

## 变更摘要
- 修复 `wechat_media_upload` 未初始化数据库导致的错误，并统一创建时间戳为毫秒
- 修复 Express 错误处理中间件签名，确保错误被正确拦截
- 微信 API 客户端错误日志脱敏与稳定化：仅记录状态码/消息
- 增加 SSE 响应头跨域来源的环境配置支持

## 升级与配置
- 建议在生产环境设置：
  - `WECHAT_MCP_SECRET_KEY`：启用敏感字段加密存储
  - `CORS_ORIGIN`：逗号分隔域名白名单（例如：`https://a.example.com,https://b.example.com`）
- 临时素材 `createdAt` 统一为毫秒时间戳（旧数据不受影响）

## 致谢
- 感谢所有用户的使用与反馈。本次发布同时已发布至 npm：`wechat-official-account-mcp@1.1.0`。

---

如需在 GitHub 创建 Release，可使用以下命令（需已安装并登录 `gh`）：

```
gh release create v1.1.0 -t "v1.1.0" -F RELEASE_NOTES_v1.1.0.md
```
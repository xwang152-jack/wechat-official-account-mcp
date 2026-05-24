# Changelog

## v2.2.0 (2026-05-24)

### 新增 6 个工具模块

从 15 个工具扩展到 21 个工具，新增 6 个高优先级功能模块。

#### 16. 二维码管理工具 (`wechat_qrcode`)

- `create_temp`: 创建临时二维码（支持整数/字符串场景值，可设有效期，最长30天）
- `create_permanent`: 创建永久二维码（支持整数/字符串场景值）
- `get_url`: 通过 ticket 换取二维码图片 URL

**使用场景**: 渠道追踪、线下推广、扫码关注、活动统计

#### 17. 短链接工具 (`wechat_short_url`)

- `generate`: 将长链接转换为微信短链接

**使用场景**: 二维码内容缩短、短信链接、分享优化

#### 18. 评论管理工具 (`wechat_comment`)

- `open`: 打开已群发文章的评论功能
- `close`: 关闭已群发文章的评论功能
- `list`: 查看评论列表（支持分页和类型筛选）
- `mark_elect`: 标记评论为精选
- `unmark_elect`: 取消精选标记
- `delete`: 删除评论
- `reply`: 回复评论
- `delete_reply`: 删除评论回复

**使用场景**: 文章互动管理、精选评论展示、用户互动回复

#### 19. 黑名单管理工具 (`wechat_blacklist`)

- `get_list`: 获取黑名单列表（支持分页）
- `block`: 拉黑用户（最多20个）
- `unblock`: 取消拉黑用户（最多20个）

**使用场景**: 用户管理、恶意用户屏蔽

#### 20. 客服账号管理工具 (`wechat_kf_account`)

- `add`: 添加客服账号
- `update`: 修改客服账号信息
- `delete`: 删除客服账号
- `get_list`: 获取所有客服账号列表

**使用场景**: 多客服管理、客服人员配置

#### 21. 账号管理工具 (`wechat_account`)

- `clear_quota`: 重置 API 调用次数（每月10次）
- `get_quota`: 查询指定 API 的调用次数配额

**使用场景**: API 调用频率监控、配额管理

### 技术改进

- **API Client 扩展**: 新增约 20 个 API 方法（二维码、短链接、评论、黑名单、客服账号、账号管理）
- **AuthManager 扩展**: 新增 `getAppId()` 方法，供账号管理 API 使用
- **TypeScript strict**: 所有新代码均通过 strict 模式编译
- **Zod 验证**: 所有新工具使用 `.parse()` 运行时验证

---

## v2.1.0 (2026-05-24)

### 代码质量与安全加固

基于三维度代码审查（TypeScript 质量、安全性、架构设计），系统性修复 6 个 CRITICAL、10 个 HIGH、12+ 个 MEDIUM 级别问题。

#### 安全修复 (CRITICAL)

- **路径遍历修复**: 新增 `validateFilePath()` 函数，所有文件读取路径经过 `path.resolve()` + 父目录拒绝校验
- **输入验证强化**: 所有 15 个 MCP 工具 handler 中 `args as any` 替换为 `schema.parse(args)`，Zod schema 运行时验证 100% 覆盖
- **凭证脱敏**: Access Token 返回值脱敏为前8后4位，AppSecret 在 `get_config` 中仅显示 `***`
- **CORS 安全**: SSE 模式默认值从 `*` 改为 `localhost`，添加全局 CORS 中间件覆盖所有路由
- **解密安全**: `decryptValue` 失败时记录错误日志，不再静默回退到加密密文
- **TypeScript strict 模式**: `tsconfig.json` 启用 `"strict": true`

#### 资源管理修复 (HIGH)

- **共享 StorageManager**: 移除每次操作新建实例的反模式，通过 `AuthManager.getStorageManager()` 获取共享实例
- **优雅关闭**: 新增 `AuthManager.dispose()` 方法，在 SIGINT/SIGTERM 信号中正确关闭 SQLite 连接
- **SSE 连接清理**: `req.on('close')` 中调用 `mcpServer.close()` 释放资源

#### 架构改进 (MEDIUM)

- **统一错误处理**: 所有工具 handler 异常冒泡到 `WechatMcpTool.registerTools()` 统一 catch，消除 3 种不一致的错误处理策略
- **消除重复代码**: auth-tool 合并 `handleAuthTool`/`handleAuthMcpTool` 为 `handleAuthCore`（减少约 80 行），publish-tool `statusMap` 提取为模块级常量
- **共享 getVersion**: 提取 `src/utils/version.ts`，消除 cli.ts 和 init.ts 的重复实现
- **日志脱敏修复**: `isSensitive ? sanitizeValue(val) : sanitizeValue(val)` 两个相同分支修正为 `isSensitive ? sanitizeValue(val) : val`
- **同步改异步**: `fs.readFileSync` 替换为 `await fs.promises.readFile`
- **CLI 参数验证**: mode 和 port 参数添加运行时校验
- **环境变量**: `DB_PATH` 环境变量实际生效，`.gitignore` 添加 `data/` 和 `.env`
- **全局错误处理器**: 消除 cli.ts/stdio.ts/sse.ts 三处重复注册
- **前端代码排除**: tsconfig.json 精确 include 后端目录，前端文件不再参与编译

#### 类型安全

- `isValidMediaType` 中 `as any` 改为 `(ALLOWED_MEDIA_TYPES as readonly string[]).includes()`
- mass-send-tool/menu-tool/subscribe-msg-tool 定义具体接口替代 `any` 类型
- MCP handler 签名匹配 `RequestHandlerExtra<ServerRequest, ServerNotification>`
- storage-manager promisify 调用添加显式类型声明

## v2.0.0 (2025-02-16)

### 重大更新 🎉

本次更新全面覆盖微信公众号API核心功能，从6个工具扩展到15个工具，新增9个功能模块，打造最完整的微信公众号MCP服务。

### 新增功能模块

#### 1. 用户管理 (`wechat_user`)
- 获取用户列表（支持分页）
- 获取用户基本信息（支持UnionID）
- 批量获取用户信息（最多100个）
- 设置用户备注名
- 获取用户增减数据统计
- 获取累计用户数据统计

#### 2. 标签管理 (`wechat_tag`)
- 创建、编辑、删除标签
- 批量为用户打标签/取消标签
- 获取标签下用户列表
- 支持用户分组和精准营销

#### 3. 自定义菜单 (`wechat_menu`)
- 创建、查询、删除自定义菜单
- 支持个性化菜单（基于标签、性别、地区等）
- 获取菜单配置信息
- 支持多种菜单类型（click、view、扫码等）

#### 4. 模板消息 (`wechat_template_msg`)
- 发送模板消息
- 获取模板列表
- 删除模板
- 获取账号所属行业信息
- 支持自定义颜色和跳转链接

#### 5. 客服消息 (`wechat_customer_service`)
- 发送文本、图片、语音、视频、音乐、图文消息
- 获取客服聊天记录
- 支持48小时内主动回复
- 支持多种媒体类型

#### 6. 数据统计分析 (`wechat_statistics`)
- 图文数据统计（阅读、分享、收藏）
- 消息数据统计（发送概况）
- 接口分析数据（调用次数、失败率、耗时）
- 用户增减数据统计
- 支持日统计和分时统计

#### 7. 自动回复规则 (`wechat_auto_reply`)
- 查询关注后自动回复
- 查询消息自动回复
- 查询关键词自动回复
- 获取当前自动回复配置

#### 8. 群发消息 (`wechat_mass_send`)
- 根据标签群发消息
- 根据OpenID列表群发
- 支持图文、文本、图片、语音、视频、卡券
- 删除群发消息
- 预览群发消息
- 支持群发全部用户或指定标签

#### 9. 订阅通知 (`wechat_subscribe_msg`)
- 发送一次性订阅通知
- 支持小程序跳转
- 支持自定义模板数据

### 技术改进

- **API Client 扩展**: 从 6 个 API 方法扩展到 60+ 个方法
- **完整的类型定义**: 所有新增API都有完整的TypeScript类型定义
- **统一的错误处理**: 所有新工具遵循统一的错误处理和日志规范
- **参数验证**: 使用Zod进行严格的输入参数验证
- **代码组织**: 新增9个工具文件，代码结构清晰

### 文档更新

- 新增 `API_FEATURES_ANALYSIS.md` - 详细的功能分析与规划文档
- 新增 `FEATURE_IMPLEMENTATION_GUIDE.md` - 快速实现指南
- 更新 `README.md` - 完整的15个工具使用说明
- 更新 `CLAUDE.md` - 架构和开发规范

### 安全增强

- 保持所有安全特性（加密存储、日志脱敏、CORS配置）
- 新增工具同样遵循安全最佳实践
- 输入验证和输出过滤

### 破坏性变更

无破坏性变更，所有新功能都是新增的，不影响现有功能。

### 升级建议

1. **测试环境验证**: 建议先在测试环境验证所有新功能
2. **API权限检查**: 部分功能需要特定的公众号权限（如认证服务号）
3. **配置检查**: 确保环境变量正确配置（`CORS_ORIGIN`、`WECHAT_MCP_SECRET_KEY`）
4. **文档阅读**: 阅读新功能文档了解使用方法

### 2025年重要提醒

⚠️ **自2025年7月起**：
- 个人账号将失去API发布权限
- 未认证企业账号将失去API权限
- 建议使用已认证的服务号进行开发

### 下一步计划

- [ ] 添加单元测试和集成测试
- [ ] 添加更详细的使用示例
- [ ] 优化错误提示信息
- [ ] 添加性能监控和日志分析

---

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
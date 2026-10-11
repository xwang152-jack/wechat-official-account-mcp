# Changelog

## v2.2.1 (2026-10-11)

### 对齐微信官方接口最新变化

从 21 个工具扩展到 22 个工具，并修复 4 处导致工具不可用的真实缺陷。

#### 新增：商品卡片工具 (`wechat_product_card`)

- `get_card_info`: 获取在文章中插入视频号小店商品卡片所需的 DOM 结构与 `product_key`
- `articleType` 支持 `news`（大卡/小卡/文字链接）、`newspic`（小卡/文字链接/条卡）
- 错误码：`53404` 账号已被限制带货能力、`53405` 插入商品信息有误、`53406` 请先开通带货能力

**使用场景**: 公众号文章带货、文末商品挂载

#### 草稿支持图片消息与带货

`wechat_draft` 的 `articles[]` 新增字段：

- `articleType`: `news`（默认）/ `newspic`（图片消息）
- `imageInfo.imageList`: 图片消息图片列表（最多 20 张，首张为封面）
- `coverInfo.cropPercentList`: 封面裁剪（`2.35_1`、`1_1`，newspic 额外支持 `16_9`）
- `productInfo.footerProductInfo.productKey`: 文末商品卡片

新增跨字段校验：`news` 必须有 `thumbMediaId`，`newspic` 必须有 `imageInfo.imageList`。

#### 新增：「发表内容」数据统计接口

官方已将旧图文统计接口标注为「停止维护」，本次补齐推荐替代接口：

- `wechat_statistics.get_article_read`: 每日阅读数据（含来源场景）
- `wechat_statistics.get_article_share`: 每日分享数据
- `wechat_statistics.get_biz_summary`: 概况总数据（跨度最长 30 天）
- `wechat_statistics.get_article_total_detail`: 发表详细数据（完读率、平均阅读时长、跳出位置等）

内置校验：上述接口日期跨度仅支持 1 天，超出时给出明确报错。
约束：数据自 2025-11-01 起，仅认证账号可用，T+1。

#### 新增：账号与配额管理

- `wechat_account.clear_api_quota`: 重置指定接口调用次数
- `wechat_account.get_rid_info`: 用 rid 查询接口报错的请求/响应详情
- `wechat_account.get_api_domain_ip`: 获取微信 API 服务器 IP 列表
- `wechat_account.change_openid`: 账号迁移后转换 openid

#### 新增：稳定版 Access Token（可选）

设置 `WECHAT_STABLE_TOKEN=true` 启用 `/cgi-bin/stable_token`。该 token 与 `getAccessToken` 互相隔离，多次获取不会使旧 token 失效，适合多实例并发场景。

### 修复

- **`wechat_short_url` 参数错误**：原实现调用 `/cgi-bin/shorten/gen` 时传 `action: long2short` / `long_url`，微信返回 `47003 参数错误`，该工具此前完全不可用。现按官方契约改为长信息 → 短 key（15 字节 base62），并新增 `fetch` 操作还原。
- **`wechat_statistics` 全部旧 action 输出 `undefined`**：原按 camelCase 读取响应（`item.refDate`），微信实际返回 snake_case（`ref_date`），导致 7 个 action 的所有指标均无法显示。
- **`wechat_publish` 状态码映射错位**：原映射自 `1` 起全部错误（`1` 被标为「发布失败」，实际为「发布中」，与 `2` 颠倒），且缺少 `4`~`6` 三个状态。
- **`wechat_publish.get` 崩溃**：发布中（`publish_status=1`）时官方不返回 `article_detail`，原代码直接读取 `article_detail.item[0]` 会抛异常。
- **`wechat_publish.list` 字段错位**：原按不存在的 `publish_status` / `article_detail` 渲染，改为按 `batchget` 真实结构（`content.news_item`）。

### 行为变更

- **Node.js 最低版本提升至 20.17**：受 `sqlite3` v6 的 `engines` 约束（原为 Node 18+）。Node 18 已于 2025-04 EOL。
- **`wechat_draft` 摘要上限收紧**：`digest` 由 256 字改为 120 字，对齐官方 2026-07-14 变更。
- **`wechat_short_url` 返回字段变更**：由 `shortUrl` 改为 `shortKey`。注意短 key 不是可直接点击的短链接，需用 `fetch` 还原。

### 新增：远程部署（Streamable HTTP 传输）

新增 `--mode http`，采用 MCP 规范当前推荐的 **Streamable HTTP** 传输，取代已被规范废弃的 SSE。

```bash
MCP_HTTP_TOKEN=$(openssl rand -hex 32) \
CORS_ORIGIN=https://your-client.example \
npx wechat-mcp mcp -a <appId> -s <appSecret> -m http -p 3000
```

- 端点：`POST /mcp`（无状态，每请求独立 transport）、`GET /healthz`（免鉴权探活）
- 鉴权：设置 `MCP_HTTP_TOKEN` 后所有 `/mcp` 请求需带 `Authorization: Bearer <token>`；未设置时启动即告警
- CORS：`CORS_ORIGIN` 逗号分隔白名单，不再使用通配符
- 无状态模式下 `GET`/`DELETE /mcp` 返回 405
- `--mode sse` 保留但打出废弃告警（该传输无鉴权，不建议继续使用）
- 新增 `scripts/verify-http-transport.mjs`：起真实服务校验鉴权边界（无 token / 错 token 均 401、正确 token 可握手），已并入 `npm run verify`

#### 为什么是单租户自托管，而不是多租户托管

多租户托管方案经评估后**未采用**，原因有二：

1. **Claude 的 connector 鉴权不支持「用户粘贴静态密钥」**（`static_bearer` 明确列为 not supported）。而「用户自带微信 appId/appSecret」本质就是静态密钥，套不进 CIMD/DCR 的 OAuth 流程，只能走需要事先联系 Anthropic 报备的 `custom_connection`。
2. **微信要求调用方 IP 在账号后台白名单**（否则报 `40164 invalid ip`）。托管服务须让每个用户把服务出口 IP 加进自己的公众号后台，接入摩擦大。

自托管形态则没有这两个问题：部署者持有自己的凭据，把自己的服务器 IP 加白即可。

### 返回值结构化：全部工具改为 JSON

101 个 action 的返回从「中文散文」改为**结构化 JSON**，Claude 现在可以可靠地解析字段、复用上一轮返回的 ID。

- 新增 `src/mcp-tool/json-result.ts` 统一出口：`jsonResult()` 正常返回 / `failureResult()` 结构化失败
- 约定：每个返回必带 `action` 字段；字段名 camelCase；缺省值 `null` 不省略键；后续调用需要的 ID（`mediaId`、`publishId`、`tagId`、`userCommentId` 等）必须出现；列表类返回带 `count`/`total`/`truncated` 以便判断截断
- 时间戳统一为 ISO 8601 或原始 unix 秒，不再用 `toLocaleString()` 输出人类可读串

### 🔴 修复：微信 API 字段名错配（15 处，工具此前静默失效）

微信返回 `snake_case`，本项目 TS 层用 `camelCase`。凡是**声明 camelCase 字段却直接 `return response.data`** 的方法，消费方拿到的全是 `undefined` —— 不报错、不抛异常，只是结果为空。本次一次性修复 15 处：

**请求体方向（发出去的报文微信认不出）**
- `sendMassMessageByTag` / `sendMassMessageByOpenId`：`isToAll`/`tagId`/`mediaId` 等未转 `is_to_all`/`tag_id`/`media_id`，群发实际发不出去
- `sendCustomMessage`：`mediaId`/`thumbMediaId`/`cardId` 未转 snake_case
- `sendTemplateMessage` / `sendSubscribeMessage`：`templateId` 未转 `template_id`
- `deleteMassMessage`：`msgId`/`articleIdx` 未转 `msg_id`/`article_idx`
- `createMenu` / `addConditionalMenu`：按钮 `mediaId` 未转 `media_id`（含 `sub_button` 递归）

**响应方向（读到的字段不存在）**
- `getUserList`：`next_openid` 未映射为 `nextOpenid`
- `getUserInfo` / `batchGetUserInfo`：`headimgurl`/`subscribe_time`/`unionid`/`groupid`/`tagid_list` 未映射
- `getCommentList`：`user_comment_id`/`create_time`/`comment_type` 未映射
- `getAllPrivateTemplates`：`template_id` 未映射
- `getTemplateIndustry`：`first_class`/`second_class` 未映射
- `getCurrentAutoReplyInfo`：字段名与微信完全不同（`is_add_friend_reply`/`is_autoreply`/`add_friend_autoreply_info`/`keyword_autoreply_info`），导致自动回复工具此前**返回全空**
- `getProductCardInfo`：`product_key` 未映射

新增 `scripts/verify-api-normalization.mjs`：用真实 `WechatApiClient`（仅替换底层 HTTP）逐字段断言映射结果，已并入 `npm run verify`。这类缺陷不报错、只能靠取值发现，必须有守卫。

### 工具架构重构：读写分离 + 目录检索

**破坏性变更** —— 对外工具从 22 个「一个工具 + action 枚举」的多路复用工具，重构为 14 个读写严格分离的工具。

#### 新架构

| 类别 | 工具 | 说明 |
| --- | --- | --- |
| 元工具 | `search_actions` | 按关键词检索全部 101 个动作 |
| 元工具 | `execute_read_action` | 执行只读动作（拒绝写操作） |
| 元工具 | `execute_write_action` | 执行写入动作（拒绝只读操作） |
| 内容域 | `wechat_content_read` / `wechat_content_write` | 草稿 + 发布 |
| 素材域 | `wechat_media_read` / `wechat_media_write` | 永久素材 + 临时素材 + 图文内图片 |
| 用户域 | `wechat_audience_read` / `wechat_audience_write` | 粉丝 + 标签 + 黑名单 |
| 互动域 | `wechat_engagement_read` / `wechat_engagement_write` | 文章评论 |
| 消息域 | `wechat_messaging_read` / `wechat_messaging_write` | 模板 + 客服 + 订阅 + 群发 |
| 数据 | `wechat_statistics` | 发表内容/消息/接口统计（本身全只读） |

长尾能力（菜单、二维码、短链、客服账号、账号配额、自动回复、商品卡片、认证配置）不再单独建工具，改由 `search_actions` 检索后用 `execute_*_action` 执行。

#### 为什么这样拆

Anthropic connector 审核要求读写必须在不同工具中。但本项目原本 16 个工具是「一个工具 + 多 action」模式，直接按读写两两拆分会得到约 38 个工具，落入审核文档自己劝退的「30+ 应改用 search + execute」区间。因此采用混合模式：**高频业务域拆成读写对，长尾走目录检索**，最终 14 个工具落在推荐的 1–15 甜蜜区。

#### 实现要点

- 新增 `src/mcp-tool/registry.ts`：101 个动作的目录，逐条标注读写模式（`r` 只读 / `w` 仅新增 / `d` 删除覆盖）。这是读写分离的**唯一事实来源**
- 域工具由目录**生成**，action 实现与参数 schema 复用原 22 个工具，未重写任何业务逻辑
- 原 22 个工具保留为实现层，由 registry 分发，不再直接注册给客户端
- 新增 server `instructions`，说明「域工具 + 目录检索」架构与首次配置路径
- 分发层强制校验：只读入口执行写操作会被直接拒绝（已在线级测试覆盖）

#### 破坏性影响

- 原工具名（`wechat_draft`、`wechat_publish` 等）不再对外暴露，调用方需改用域工具或 `execute_*_action`
- 库级选项 `McpServerOptions.tools` 若指定了旧工具名会因「未启用」而失败
- 若用于提交 Anthropic Directory，本项是必要的合规改造

### MCP 协议合规（对照 Anthropic connector 审核标准）

- **为全部 22 个工具补上 annotations**：`title` + `readOnlyHint` + `destructiveHint`。此前完全缺失，导致 Claude 无法为只读工具免确认、也无法对破坏性工具强制弹确认。注解集中维护在 `src/mcp-tool/tools/index.ts` 的 `TOOL_ANNOTATIONS`
- **修复错误未标记为错误**：`registerTools` 的异常分支此前返回普通 content，失败调用在协议层看起来是一次成功结果；现已置 `isError: true`
- **移除描述中的引导性措辞**：`wechat_statistics` 描述里原有的「推荐使用 …」改为中性事实陈述（审核标准禁止工具描述引导 Claude 行为）
- 新增 `scripts/verify-mcp-protocol.mjs`：起真实 stdio 服务走完整协议，校验 annotations 确实序列化进 `tools/list`、且工具异常确实返回 `isError:true`。已并入 `npm run verify`
- `npm test` 新增注解覆盖守卫：新增工具未登记注解会导致测试失败

> 已知遗留：22 个工具中有 16 个在单个工具内同时暴露只读与写操作（如 `wechat_draft` 同时含 get/list/count 与 add/update/delete）。Anthropic 审核标准要求读写必须拆分为独立工具，此项属结构性重构，本次未做。

### 依赖升级与安全修复

`npm audit` 从 **35 个漏洞（2 critical / 26 high）降到 0**。

- **`@modelcontextprotocol/sdk` 1.18.0 → 1.32.1**：修复 4 个 high 级公告（共享 transport 实例跨客户端数据泄露、DNS rebinding 默认未防护、ReDoS、OAuth 凭据泄露）
- **`sqlite3` 5.1.7 → 6.0.1**：清除 node-gyp → tar / cacache / make-fetch-happen 整条编译期依赖链（含 1 个 critical）
- `express` 4.21.2 → 4.22.3、`axios` 1.6 → 1.20.0、`form-data` 4.0.4 → 4.0.6：修复 body-parser / qs / path-to-regexp / follow-redirects 等传递漏洞
- `tsx` → 4.23.15、`typescript-eslint` → 8.71.1、`eslint` → 9.39.5、`@eslint/js` → 9.39.5、`globals` → 16.5.0、`@types/*` 同步

#### 升级带来的代码适配

- **`ServerInfo.id` 已移除**：MCP SDK 1.20+ 的 `ServerInfo` 只保留 `name` / `version`，`init.ts` 中删去 `id` 字段
- **`registerTool` 泛型导致 TS2589**：SDK 1.20+ 会对 `inputSchema` 做 `ShapeOutput` 映射推断，而 SDK 的 `AnySchema` 同时联合了 zod v3/v4 两套类型；配合 `McpTool.inputSchema` 的宽类型声明会使类型实例化无法收敛。已在 `registerTools()` 中用不引用 SDK 类型的窄化签名绕开泛型推断，运行时行为不变，参数校验仍由各工具内部的 zod schema 执行

#### 验证

- `npm run check` / `build` / `lint` / `test` / `verify` 全绿
- MCP 协议层实测：`initialize` 握手成功，`tools/list` 返回 22 个工具且 `inputSchema` 齐全
- 存储层实测：`config` / `access_token` / `media` 读写与列表在 sqlite3 v6 下全部通过

### 清理

- 移除仓库中残留的 Trae/Vite/React 脚手架（`api/`、`index.html`、`vite.config.ts`、`tailwind.config.js`、`postcss.config.js`、`vercel.json`、`public/` 及 `src/` 下的 React 文件）
- 移除对应的 React/Vite/Tailwind/Vercel 开发依赖，以及未使用的 `cors`、`dotenv`、`jsonwebtoken`、`multer` 运行时依赖
- 移除失效的 `nodemon.json` 与指向不存在脚本的 `pack:test`
- `tsconfig.json` / `tsconfig.prod.json` 不再包含 `api`，`eslint.config.js` 改用 Node 环境规则（原为 browser + React 规则）
- 修复 `test-tools.js` 中写死的「15 个工具」断言（该断言长期静默失效）
- 新增 `graphify-out/` 到 `.gitignore`

### 新增校验

- `npm run verify`：无框架依赖的自检脚本，覆盖草稿字段映射、跨字段校验、统计日期守卫、发布状态码映射

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
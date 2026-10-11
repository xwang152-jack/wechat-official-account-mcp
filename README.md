# 微信公众号 MCP 服务

一个为 AI 应用提供微信公众号 API 集成的 MCP (Model Context Protocol) 服务项目。

**作者**: xwang152-jack <xwang152@163.com>
**更新日期**: 2026年05月24日

## 🚀 项目概述

本项目基于 MCP 协议，为 AI 应用（如 Claude Desktop、Cursor、Trae AI 等）提供**完整**的微信公众号 API 集成。通过标准化的工具接口，AI 应用可以轻松管理微信公众号的用户、标签、菜单、素材、草稿、发布、消息、数据统计、二维码、评论、黑名单等**所有核心功能**。

**当前版本**: `v2.2.1` （查看 [CHANGELOG](./CHANGELOG.md)）

**v2.2.1 更新**: 工具架构重构为「读写分离 + 目录检索」，对外工具从 22 个多路复用工具改为 **14 个读写严格分离的工具**；对齐微信官方接口最新变化（商品卡片、图片消息草稿、发表内容统计新接口）；修复短链、发布状态码、统计字段名三处缺陷；依赖漏洞从 35 个清零。详见 [CHANGELOG](./CHANGELOG.md)。

**v2.2.0 更新**: 新增 6 个工具模块（二维码、短链接、评论管理、黑名单、客服账号、账号管理），从 15 个工具扩展到 21 个工具。

## 📖 文档导航

- **[更新日志 (CHANGELOG.md)](./CHANGELOG.md)** - 版本历史和详细更新内容
- **[开发者指南 (CLAUDE.md)](./CLAUDE.md)** - 架构说明、开发规范、常见模式

### 外部资源
- [微信公众平台官方文档](https://developers.weixin.qq.com/doc/)
- [MCP 协议规范](https://modelcontextprotocol.io/)

## ✨ 核心功能

- **🔐 认证管理**: 安全管理微信公众号 AppID、AppSecret 和 Access Token
- **📁 素材管理**: 上传、获取、管理临时和永久素材
- **📝 草稿管理**: 创建、编辑、管理图文草稿
- **📢 发布管理**: 发布草稿到微信公众号
- **💾 本地存储**: 使用 SQLite 本地存储配置和数据
- **🔧 MCP 集成**: 完全兼容 MCP 协议标准
 - **🛡️ 安全增强（v1.1.0）**: 支持敏感字段加密存储与日志脱敏，跨域来源白名单配置

## 🛠️ 技术栈

- **运行时**: Node.js 20.17+（受 sqlite3 v6 约束）
- **语言**: TypeScript
- **协议**: MCP (Model Context Protocol)
- **数据库**: SQLite
- **HTTP 客户端**: Axios
- **参数验证**: Zod
- **构建工具**: Vite

## 📦 快速开始

### 方式一：使用 npx（推荐）

直接使用 npx 运行，无需安装：

```bash
# 启动 MCP 服务器
npx wechat-official-account-mcp mcp -a <your_app_id> -s <your_app_secret>

# 示例
npx wechat-official-account-mcp mcp -a wx1234567890abcdef -s your_app_secret_here
```

> 提示：以 `--mode http` 暴露到公网时，务必设置 `MCP_HTTP_TOKEN`（鉴权）与 `CORS_ORIGIN`（来源白名单）。

### 方式二：全局安装

```bash
# 全局安装
npm install -g wechat-official-account-mcp

# 启动服务
wechat-mcp mcp -a <your_app_id> -s <your_app_secret>
```

### 方式三：本地开发

```bash
# 1. 克隆项目
git clone https://github.com/xwang152-jack/wechat-official-account-mcp.git
cd wechat-official-account-mcp

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 启动服务（推荐用环境变量，避免 AppSecret 出现在进程参数中）
WECHAT_APP_ID=<your_app_id> WECHAT_APP_SECRET=<your_app_secret> node dist/src/cli.js mcp
```

### CLI 参数说明

- `-a, --app-id <appId>`: 微信公众号 AppID（可选；也可用 `WECHAT_APP_ID`）
- `-s, --app-secret <appSecret>`: 微信公众号 AppSecret（可选；也可用 `WECHAT_APP_SECRET`）
- `-m, --mode <mode>`: 传输模式，支持 `stdio`（默认）、`http`（远程，推荐）、`sse`（已废弃）
- `-p, --port <port>`: `http`/`sse` 模式下的端口号（默认 3000）
- `--host <host>`: `http`/`sse` 模式下的绑定地址（默认 `0.0.0.0`）
- `-h, --help`: 显示帮助信息

环境变量（常用）：
- `WECHAT_APP_ID`: 微信公众号 AppID
- `WECHAT_APP_SECRET`: 微信公众号 AppSecret（推荐用环境变量传入，避免出现在命令行参数中）
- `CORS_ORIGIN`: 逗号分隔的跨域来源白名单（示例：`https://a.example.com,https://b.example.com`）
- `WECHAT_MCP_SECRET_KEY`: 自定义敏感字段加密密钥；未设置时会自动生成本地密钥
- `WECHAT_MCP_SECRET_KEY_FILE`: 自定义本地加密密钥文件路径（可选）

## 🔧 MCP 工具列表

对外暴露 **14 个工具**，按「读写分离 + 目录检索」组织。所有工具返回 JSON。

### 架构说明

Anthropic connector 审核要求**只读与写入操作必须位于不同工具**。但本项目原有 22 个工具是「一个工具 + `action` 枚举」的多路复用模式，直接按读写两两拆分会得到约 38 个工具，反而落入审核文档自己劝退的「30+ 应改用 search + execute」区间。

因此采用**混合模式**：

- **高频业务域** → 拆成 `*_read` / `*_write` 一对，读写严格分离
- **长尾能力** → 由 `search_actions` 检索 + `execute_read_action` / `execute_write_action` 执行
- **数据统计** → 本身全部只读，保持独立工具

最终 14 个工具落在官方推荐的 1–15 甜蜜区。

### 一、元工具（长尾能力入口）

**1. `search_actions`** — 检索服务支持的全部动作（共 101 个）

- `query`: 检索关键词，中英文均可，多词为 AND 语义
- `mode`: 按读写模式过滤（`r` 只读 / `w` 仅新增 / `d` 删除覆盖）
- `limit`: 返回条数上限，默认 20

返回动作 ID、读写模式与说明。**不调用微信接口，不修改任何数据。**

**2. `execute_read_action`** — 执行只读动作

- `action_id`: 动作 ID，如 `wechat_menu.get`
- `params`: 业务参数对象

只接受模式为 `r` 的动作，传入写操作会被直接拒绝。

**3. `execute_write_action`** — 执行写入动作

- `action_id`: 动作 ID，如 `wechat_menu.create`
- `params`: 业务参数对象

只接受模式为 `w`（仅新增）或 `d`（删除覆盖）的动作。

> 长尾能力覆盖：菜单、二维码、短链、客服账号、账号配额与 rid 排查、openid 转换、自动回复规则、商品卡片、认证配置。

### 二、域工具（高频业务，读写成对）

每个域提供 `*_read`（只读）与 `*_write`（写入）两个工具，用 `action` 参数选择具体操作。

| 工具 | 只读 action | 写入/破坏性 action |
| --- | --- | --- |
| `wechat_content_read` / `wechat_content_write` | 草稿 get/list/count、发布 get/list | 草稿 add/update/delete、发布 submit/delete |
| `wechat_media_read` / `wechat_media_write` | 永久素材 get/list/count、临时素材 get/list | 永久素材 add/update/delete、临时素材 upload、图文内图片上传 |
| `wechat_audience_read` / `wechat_audience_write` | 用户列表/资料/增减统计、标签列表、黑名单列表 | 设置备注、标签增删改与批量打标、拉黑/取消拉黑 |
| `wechat_engagement_read` / `wechat_engagement_write` | 评论列表 | 开关评论、精选/取消精选、回复、删除评论与回复 |
| `wechat_messaging_read` / `wechat_messaging_write` | 模板列表与行业、客服聊天记录、群发预览 | 模板消息发送与管理、客服消息、订阅通知、群发与删除 |

**示例：**

```
wechat_content_read  { action: "list", count: 10 }              # 列出最近草稿
wechat_content_write { action: "add", articles: [ ... ] }        # 新建草稿
wechat_content_write { action: "submit", mediaId: "..." }        # 提交发布
```

### 三、数据统计

**14. `wechat_statistics`** — 完全只读

- 发表内容系列（推荐）：`get_article_read`、`get_article_share`、`get_biz_summary`、`get_article_total_detail`
- 旧图文系列（微信官方已标注停止维护）：`get_article_summary`、`get_article_total`、`get_user_read`、`get_user_share`
- 消息与接口：`get_upstream_message`、`get_interface_summary`、`get_interface_summary_hour`

> 发表内容系列数据自 2025-11-01 起、仅认证账号可用；其中 `get_article_read`、`get_article_share`、`get_article_total_detail` 的日期跨度仅支持 1 天，`get_biz_summary` 最长 30 天。

### 首次配置

```
1. search_actions        { query: "认证" }
2. execute_write_action  { action_id: "wechat_auth.configure",
                           params: { appId: "wx...", appSecret: "..." } }
```

## 📁 项目结构

```
src/
├── cli.ts               # CLI 入口文件
├── index.ts             # 模块导出入口
├── mcp-server/          # MCP 服务器实现
│   ├── shared/          # 共享组件
│   │   ├── init.ts      # 服务器初始化
│   │   └── types.ts     # 类型定义
│   └── transport/       # 传输层实现
│       ├── stdio.ts     # stdio 传输
│       ├── http.ts      # Streamable HTTP 传输（推荐）
│       └── sse.ts       # SSE 传输（已废弃）
├── mcp-tool/            # MCP 工具实现
│   ├── index.ts         # 工具管理器（统一错误处理）
│   ├── types.ts         # 类型定义
│   ├── registry.ts      # 101 个动作的目录（读写模式的唯一事实来源）
│   ├── domains.ts       # 域工具生成器（读写成对）
│   ├── public-tools.ts  # 对外工具面（14 个）
│   └── tools/           # 22 个实现层工具（均含 Zod 验证，经 registry 分发）
├── auth/                # 认证管理
│   └── auth-manager.ts  # Token 管理 + dispose()
├── wechat/              # 微信 API 客户端
│   └── api-client.ts
├── storage/             # 数据存储
│   └── storage-manager.ts  # SQLite + AES 加密
└── utils/               # 工具函数
    ├── logger.ts        # 日志（含敏感字段脱敏）
    ├── validation.ts    # Zod schema + 路径校验 + HTML 清理
    └── version.ts       # 共享版本号获取
```

## 🌐 远程部署（Streamable HTTP）

以 HTTP 模式启动，供远程 MCP 客户端接入：

```bash
MCP_HTTP_TOKEN=$(openssl rand -hex 32) \
CORS_ORIGIN=https://your-client.example \
npx wechat-mcp mcp -a <appId> -s <appSecret> -m http -p 3000
```

| 端点 | 说明 |
| --- | --- |
| `POST /mcp` | MCP 端点（无状态，每请求独立传输） |
| `GET /healthz` | 探活，不鉴权 |

| 环境变量 | 作用 |
| --- | --- |
| `MCP_HTTP_TOKEN` | 设置后所有 `/mcp` 请求需带 `Authorization: Bearer <token>`；**暴露公网前必须设置** |
| `CORS_ORIGIN` | 逗号分隔的来源白名单，不使用通配符 |

> ⚠️ **微信 IP 白名单**：公众号 API 要求调用方 IP 在账号后台白名单内，否则返回 `40164 invalid ip`。
> 部署到服务器后，需把该服务器的出口 IP 加入「公众号后台 → 开发 → 基本配置 → IP 白名单」。

### 关于多租户托管

本项目**不提供**多租户托管形态，原因是 Claude 的 connector 鉴权不支持「用户粘贴静态密钥」（`static_bearer` 属 not supported），而「用户自带微信 appId/appSecret」正是这种形态，无法套用 CIMD/DCR 的 OAuth 流程。自托管单租户没有这个问题：凭据由部署者自己持有。

---

## 🔗 在 AI 应用中使用

### Claude Desktop

在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "wechat-official-account": {
      "command": "npx",
      "args": [
        "wechat-official-account-mcp",
        "mcp",
        "-a", "your_wechat_app_id",
        "-s", "your_wechat_app_secret"
      ]
    }
  }
}
```

或者使用全局安装的版本：

```json
{
  "mcpServers": {
    "wechat-official-account": {
      "command": "wechat-mcp",
      "args": [
        "mcp",
        "-a", "your_wechat_app_id",
        "-s", "your_wechat_app_secret"
      ]
    }
  }
}
```

### Cursor / Trae AI

在 MCP 配置中添加服务器配置：

```json
{
  "mcpServers": {
    "wechat-official-account": {
      "command": "npx",
      "args": [
        "wechat-official-account-mcp",
        "mcp",
        "-a", "your_wechat_app_id",
        "-s", "your_wechat_app_secret"
      ]
    }
  }
}
```

或者使用全局安装的版本：

```json
{
  "mcpServers": {
    "wechat-official-account": {
      "command": "wechat-mcp",
      "args": [
        "mcp",
        "-a", "your_wechat_app_id",
        "-s", "your_wechat_app_secret"
      ]
    }
  }
}
```



## 🧪 开发指南

### 开发模式

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 本地测试 CLI
node dist/src/cli.js mcp -a test_app_id -s test_app_secret

# 类型检查
npm run check

# 代码检查
npm run lint
```

### 构建和发布

```bash
# 构建项目
npm run build

# 本地测试包
npm pack

# 发布到 npm
npm publish
```

### 测试

```bash
# 运行测试
npm test

# 测试 CLI 功能
node dist/src/cli.js --help
```

## 📝 配置说明

### 环境变量

创建 `.env` 文件：

```env
# 开发模式（可选）
NODE_ENV=development

# 调试模式（可选）
DEBUG=true

# 跨域来源白名单（强烈建议生产环境设置）
CORS_ORIGIN=https://your-domain.com,https://another-domain.com

# 自定义敏感字段加密密钥（可选；未设置时会自动生成本地密钥）
WECHAT_MCP_SECRET_KEY=your-strong-secret-key

# 自定义本地密钥文件路径（可选）
WECHAT_MCP_SECRET_KEY_FILE=./data/.secret-key

# 数据库路径（可选，默认为 ./data/wechat-mcp.db）
DB_PATH=./data/wechat-mcp.db
```

### 微信公众号配置

1. 登录微信公众平台
2. 进入「开发」->「基本配置」
3. 获取 AppID 和 AppSecret
4. 使用 `wechat_auth` 工具进行配置

## 🔒 安全说明

- **TypeScript strict 模式**: 全项目启用严格类型检查，消除隐式 any 和空值风险
- **输入验证**: 所有 22 个 MCP 工具均通过 Zod schema 执行 `.parse()` 运行时验证，无任何绕过
- **路径安全**: 文件上传路径经过 `validateFilePath()` 校验，防止路径遍历攻击
- **凭证保护**: Access Token 在返回值中脱敏显示（前8后4），AppSecret 仅显示 `***`
- **凭证传递**: CLI 支持 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 环境变量，推荐用环境变量传入 AppSecret，避免敏感值出现在命令行参数中
- **加密存储**: `app_secret/token/encoding_aes_key/access_token` 默认以 AES 加密形式持久化（带 `enc:` 前缀标识）；未设置 `WECHAT_MCP_SECRET_KEY` 时会自动生成本地密钥文件
- **日志脱敏**: 敏感字段自动识别并脱敏，非敏感信息保留原值，确保日志可读性
- **HTTP 鉴权**: `--mode http` 下设置 `MCP_HTTP_TOKEN` 后，所有 `/mcp` 请求必须带 `Authorization: Bearer`；未设置时启动即告警
- **CORS 安全**: `CORS_ORIGIN` 为精确域名白名单，不使用通配符；未配置时不允许跨源
- **资源管理**: 数据库连接通过 `dispose()` 正确关闭，请求/连接结束时清理 MCP 服务器实例
- **解密安全**: 加密数据解密失败时不再静默回退到密文，而是记录错误并返回 null
- 切勿提交密钥：`.gitignore` 已包含 `data/` 和 `.env` 规则，防止敏感数据意外提交

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🆘 支持

如果您遇到问题或有建议，请：

1. 查看 [Issues](https://github.com/xwang152-jack/wechat-official-account-mcp/issues) 页面
2. 创建新的 Issue
3. 联系项目维护者: xwang152-jack <xwang152@163.com>

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP 协议标准
- [微信公众平台](https://mp.weixin.qq.com/) - 微信公众号 API
- [Anthropic](https://www.anthropic.com/) - Claude Desktop MCP 支持

---

**注意**: 本项目仅供学习和开发使用，请遵守微信公众平台的使用条款和相关法律法规。

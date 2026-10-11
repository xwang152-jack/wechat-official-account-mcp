# 微信公众号 MCP 服务

为 AI 应用（Claude Desktop、Cursor 等）提供微信公众号 API 集成的 MCP 服务。

**当前版本**: `v2.2.1` · [更新日志](./CHANGELOG.md) · [开发者指南](./CLAUDE.md)

- **运行时**: Node.js 20.17+
- **协议**: MCP (Model Context Protocol) · **存储**: SQLite · **语言**: TypeScript

---

## 快速开始

```bash
WECHAT_APP_ID=<your_app_id> WECHAT_APP_SECRET=<your_app_secret> npx wechat-official-account-mcp mcp
```

接入 Claude Desktop，在 `claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "wechat-official-account": {
      "command": "npx",
      "args": ["wechat-official-account-mcp", "mcp"],
      "env": {
        "WECHAT_APP_ID": "<your_app_id>",
        "WECHAT_APP_SECRET": "<your_app_secret>"
      }
    }
  }
}
```

> 推荐用环境变量而非 `-a/-s` 参数传 AppSecret，避免密钥出现在进程命令行里。

凭据会存入 `./data/wechat-mcp.db`，其中 `app_secret` 等敏感字段默认 AES 加密（密钥未指定时自动生成于 `./data/.secret-key`，权限 600）。

---

## 工具

对外暴露 **14 个工具**，按「读写分离」组织：只读与写入操作位于不同工具，便于客户端对写入操作做权限控制。所有工具返回 JSON。

| 类别 | 工具 |
| --- | --- |
| 内容 | `wechat_content_read` / `wechat_content_write` — 草稿与发布 |
| 素材 | `wechat_media_read` / `wechat_media_write` — 永久/临时素材、图文内图片 |
| 用户 | `wechat_audience_read` / `wechat_audience_write` — 粉丝、标签、黑名单 |
| 互动 | `wechat_engagement_read` / `wechat_engagement_write` — 文章评论 |
| 消息 | `wechat_messaging_read` / `wechat_messaging_write` — 模板/客服/订阅/群发 |
| 数据 | `wechat_statistics` — 发表内容、消息、接口统计（只读） |
| 长尾 | `search_actions` + `execute_read_action` / `execute_write_action` |

每个域工具用一个 `action` 参数选择具体操作，例如：

```
wechat_content_read  { "action": "list", "count": 10 }     # 列出草稿
wechat_content_write { "action": "add", "articles": [...] } # 新建草稿
wechat_content_write { "action": "submit", "mediaId": "..." } # 提交发布
```

菜单、二维码、短链、客服账号、账号配额、自动回复、商品卡片、认证配置等长尾能力未单独建工具，先用 `search_actions` 检索动作 ID（共 101 个），再用 `execute_read_action` / `execute_write_action` 执行。服务端 `instructions` 已说明该用法。

---

## 配置

| 环境变量 | 说明 |
| --- | --- |
| `WECHAT_APP_ID` / `WECHAT_APP_SECRET` | 公众号凭据（也可用 `-a` / `-s`） |
| `WECHAT_MCP_SECRET_KEY` | 敏感字段加密密钥；未设置时自动生成本地密钥 |
| `WECHAT_MCP_SECRET_KEY_FILE` | 本地密钥文件路径，默认 `./data/.secret-key` |
| `DB_PATH` | 数据库路径，默认 `./data/wechat-mcp.db` |
| `MCP_HTTP_TOKEN` | HTTP 模式下的 Bearer 鉴权令牌 |
| `CORS_ORIGIN` | HTTP 模式下的来源白名单（逗号分隔） |
| `DEBUG` | 开启调试日志 |

AppID / AppSecret 获取：微信公众平台 → 开发 → 基本配置。

---

## 远程部署（Streamable HTTP）

```bash
MCP_HTTP_TOKEN=$(openssl rand -hex 32) \
CORS_ORIGIN=https://your-client.example \
npx wechat-official-account-mcp mcp -m http -p 3000
```

| 端点 | 说明 |
| --- | --- |
| `POST /mcp` | MCP 端点（无状态） |
| `GET /healthz` | 探活，不鉴权 |

> ⚠️ **微信 IP 白名单**：公众号 API 要求调用方 IP 在账号后台白名单内，否则报 `40164 invalid ip`。
> 部署到服务器后，需把该服务器出口 IP 加入「公众号后台 → 开发 → 基本配置 → IP 白名单」。

`--mode sse` 保留但已废弃（该传输无鉴权且被 MCP 规范取代），建议改用 `http`。

也可以直接用 Docker：`docker compose up -d`（见 `docker-compose.yml`）。
systemd + nginx 常驻部署的配置与运维步骤与环境强相关，不入库，保存在本地 `deploy/`。

---

## 开发

```bash
npm install
npm run dev -- mcp -a <app_id> -s <app_secret>   # 开发模式
npm run check && npm run lint && npm test         # 静态检查与测试
npm run verify                                    # 端到端校验（协议层 / 字段映射 / HTTP 鉴权）
npm run build                                     # 构建到 dist/
```

**相关文档**：[CHANGELOG](./CHANGELOG.md) · [CLAUDE.md](./CLAUDE.md)（架构与开发规范）· [微信官方文档](https://developers.weixin.qq.com/doc/) · [MCP 规范](https://modelcontextprotocol.io/)

---

## 安全

- **凭据加密**：`app_secret` / `access_token` / `encoding_aes_key` 默认 AES 加密落库（`enc:` 前缀）；日志对敏感字段脱敏
- **HTTP 鉴权**：`--mode http` 下设置 `MCP_HTTP_TOKEN` 后所有 `/mcp` 请求需带 `Authorization: Bearer`，未设置时启动即告警
- **CORS**：仅接受 `CORS_ORIGIN` 白名单内的来源，不使用通配符
- **输入校验**：全部工具经 Zod schema 运行时校验，HTML 内容经 `sanitizeHtmlContent()` 清理
- **凭据不外泄**：`wechat_auth` 的返回只含 `appId` 与布尔标记，不返回任何密钥或令牌

---

## 许可证

[MIT](./LICENSE) · 作者 xwang152-jack &lt;xwang152@163.com&gt;

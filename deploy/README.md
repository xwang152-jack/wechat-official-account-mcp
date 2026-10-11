# 部署到云服务器

以 systemd + nginx 的方式部署为常驻服务（不使用 Docker）。以下步骤在一台
Ubuntu 24.04 / x86_64 的腾讯云服务器上实测通过。

## 前置条件

- 服务器：Ubuntu 22.04+ / x86_64，可 `sudo`
- 已有一个解析到该服务器的域名（本例 `wechat.bingodify.cn`）
- 服务器出口 IP 已在**微信公众平台 → 开发 → 基本配置 → IP 白名单**中
  （否则所有接口调用返回 `40164 invalid ip`）

> **国内服务器的网络现实**：GitHub 与 Docker Hub 通常不可达，Debian 官方源极慢。
> 因此代码走本机 rsync 传输，Node 走腾讯内网镜像，`sqlite3` 从源码编译（拿不到
> GitHub 上的预编译产物）。

## 一、安装运行时

```bash
# 编译工具（sqlite3 原生模块需要）
sudo apt-get install -y g++ make python3

# Node 22（走腾讯内网镜像，比 nodejs.org 快得多）
NODE_VER=v22.20.0
curl -sSL -o /tmp/node.tar.xz \
  "https://mirrors.tencentyun.com/nodejs-release/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz"
sudo tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
node -v   # v22.20.0
```

## 二、同步代码

服务器拉不到 GitHub，从本机推送：

```bash
# 在本机项目根目录执行
rsync -az --delete \
  --exclude node_modules --exclude dist --exclude data --exclude graphify-out \
  --exclude deploy --exclude .env \
  ./ ubuntu@<server>:/opt/wechat-mcp/

# 编译产物（服务器未装 tsc）
rsync -az --delete ./dist/ ubuntu@<server>:/opt/wechat-mcp/dist/
```

> `deploy/` 被排除是有意的：它只存放部署配置，服务器上不参与运行，避免同步时
> 覆盖服务器侧已调整过的配置。

## 三、安装依赖

```bash
cd /opt/wechat-mcp
npm_config_build_from_source=true npm ci --omit=dev --no-audit --no-fund
```

`npm_config_build_from_source=true` 让 sqlite3 直接源码编译，跳过会长时间超时的
GitHub 预编译包下载。

## 四、配置

```bash
cd /opt/wechat-mcp
umask 077 && cat > .env <<'EOF'
WECHAT_APP_ID=<your_app_id>
WECHAT_APP_SECRET=<your_app_secret>
MCP_HTTP_TOKEN=<openssl rand -hex 32 生成的随机值>
CORS_ORIGIN=<允许的来源，如 https://claude.ai>
EOF
chmod 600 .env
```

## 五、systemd

```bash
sudo cp deploy/wechat-mcp.service /etc/systemd/system/
# 按实际路径/用户调整 User= 与 WorkingDirectory=
sudo systemctl daemon-reload
sudo systemctl enable --now wechat-mcp
systemctl status wechat-mcp
```

## 六、nginx + HTTPS

```bash
sudo cp deploy/nginx-wechat.conf /etc/nginx/sites-available/wechat
sudo ln -sf /etc/nginx/sites-available/wechat /etc/nginx/sites-enabled/wechat
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d wechat.bingodify.cn --non-interactive --agree-tos --redirect
```

## 验证

```bash
TOKEN=$(grep MCP_HTTP_TOKEN /opt/wechat-mcp/.env | cut -d= -f2)

curl -s https://wechat.bingodify.cn/healthz          # 期望 {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://wechat.bingodify.cn/mcp \
  -H 'Content-Type: application/json' -d '{}'        # 期望 401（未带 token）

curl -s -X POST https://wechat.bingodify.cn/mcp \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"1"}}}'
```

## 运维

```bash
systemctl status wechat-mcp
journalctl -u wechat-mcp -f
sudo systemctl restart wechat-mcp
```

**更新代码**：重复第二节的 rsync，再 `sudo systemctl restart wechat-mcp`。

## 注意

- `data/` 目录不可删除：除 SQLite 库外还有自动生成的 `.secret-key`，
  丢失后已加密的凭据无法解密，需重新配置。
- systemd 单元使用 `ProtectSystem=strict` + `ReadWritePaths=/opt/wechat-mcp/data`，
  只有数据目录可写；改动写入路径时需同步调整。
- 日志已交由 journald，无需额外轮转配置。

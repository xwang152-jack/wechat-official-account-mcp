# 微信公众号 MCP 服务

一个为 AI 应用提供微信公众号 API 集成的 MCP (Model Context Protocol) 服务项目。

**作者**: xwang152-jack <xwang152@163.com>  
**更新日期**: 2025年9月14日

## 🚀 项目概述

本项目基于 MCP 协议，为 AI 应用（如 Claude Desktop、Cursor、Trae AI 等）提供微信公众号 API 的无缝集成。通过标准化的工具接口，AI 应用可以轻松地管理微信公众号的素材、草稿、发布等功能。

## ✨ 核心功能

- **🔐 认证管理**: 安全管理微信公众号 AppID、AppSecret 和 Access Token
- **📁 素材管理**: 上传、获取、管理临时和永久素材
- **📝 草稿管理**: 创建、编辑、管理图文草稿
- **📢 发布管理**: 发布草稿到微信公众号
- **💾 本地存储**: 使用 SQLite 本地存储配置和数据
- **🔧 MCP 集成**: 完全兼容 MCP 协议标准

## 🛠️ 技术栈

- **运行时**: Node.js 18+
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

# 4. 启动服务
node dist/src/cli.js mcp -a <your_app_id> -s <your_app_secret>
```

### CLI 参数说明

- `-a, --app-id <appId>`: 微信公众号 AppID（必需）
- `-s, --app-secret <appSecret>`: 微信公众号 AppSecret（必需）
- `-m, --mode <mode>`: 传输模式，支持 `stdio`（默认）和 `sse`
- `-p, --port <port>`: SSE 模式下的端口号（默认 3000）
- `-h, --help`: 显示帮助信息

## 🔧 MCP 工具列表

### 1. 认证工具 (`wechat_auth`)

管理微信公众号认证配置和 Access Token。

**支持操作**:
- `configure`: 配置 AppID 和 AppSecret
- `get_token`: 获取当前 Access Token
- `refresh_token`: 刷新 Access Token
- `get_config`: 查看当前配置

### 2. 素材上传工具 (`wechat_media_upload`)

上传和管理微信公众号临时素材。

**支持操作**:
- `upload`: 上传素材（图片、语音、视频、缩略图）
- `get`: 获取素材信息
- `list`: 列出所有素材

**支持格式**:
- 图片：JPG、PNG（大小不超过 10MB）
- 语音：MP3、WMA、WAV、AMR（大小不超过 10MB，时长不超过 60s）
- 视频：MP4（大小不超过 10MB）
- 缩略图：JPG（大小不超过 64KB）

### 3. 图文消息图片上传工具 (`wechat_upload_img`)

上传图文消息内所需的图片，不占用素材库限制。

**支持操作**:
- `upload`: 上传图片（支持文件路径或base64数据）

**支持格式**:
- 图片：JPG、PNG（大小不超过 1MB）

**特点**:
- 不占用公众号素材库的100000个图片限制
- 专用于图文消息内容中的图片
- 返回可直接在图文消息中使用的图片URL

### 4. 永久素材工具 (`wechat_permanent_media`)

管理微信公众号永久素材。

**支持操作**:
- `add`: 上传永久素材（图片、语音、视频、缩略图）
- `get`: 获取永久素材
- `delete`: 删除永久素材
- `list`: 获取素材列表
- `count`: 获取素材总数统计

### 5. 草稿管理工具 (`wechat_draft`)

管理微信公众号图文草稿。

**支持操作**:
- `add`: 新建草稿
- `get`: 获取草稿详情
- `delete`: 删除草稿
- `list`: 获取草稿列表
- `count`: 获取草稿总数

### 6. 发布工具 (`wechat_publish`)

管理微信公众号文章发布。

**支持操作**:
- `submit`: 发布草稿
- `get`: 获取发布状态
- `delete`: 删除发布
- `list`: 获取发布列表

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
│       └── sse.ts       # SSE 传输
├── mcp-tool/            # MCP 工具实现
│   ├── index.ts         # 工具管理器
│   ├── types.ts         # 类型定义
│   └── tools/           # 具体工具实现
│       ├── index.ts
│       ├── auth-tool.ts
│       ├── media-upload-tool.ts
│       ├── upload-img-tool.ts
│       ├── permanent-media-tool.ts
│       ├── draft-tool.ts
│       └── publish-tool.ts
├── auth/                # 认证管理
│   └── auth-manager.ts
├── wechat/              # 微信 API 客户端
│   └── api-client.ts
├── storage/             # 数据存储
│   └── storage-manager.ts
└── utils/               # 工具函数
    ├── logger.ts
    └── db-init.ts
```

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
  "command": "npx",
  "args": [
    "wechat-official-account-mcp",
    "mcp",
    "-a", "your_wechat_app_id",
    "-s", "your_wechat_app_secret"
  ]
}
```

### 环境变量配置（可选）

您也可以通过环境变量配置微信公众号信息：

```bash
export WECHAT_APP_ID=your_wechat_app_id
export WECHAT_APP_SECRET=your_wechat_app_secret
npx wechat-official-account-mcp mcp
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
# 开发模式
NODE_ENV=development

# 调试模式
DEBUG=true

# 数据库路径（可选，默认为 ./data/wechat-mcp.db）
DB_PATH=./data/wechat-mcp.db
```

### 微信公众号配置

1. 登录微信公众平台
2. 进入「开发」->「基本配置」
3. 获取 AppID 和 AppSecret
4. 使用 `wechat_auth` 工具进行配置

## 🔒 安全说明

- AppSecret 等敏感信息使用 SQLite 本地存储
- Access Token 自动管理和刷新
- 所有 API 调用都经过错误处理和日志记录
- 支持参数验证和类型检查

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

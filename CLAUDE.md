# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Official Account MCP (Model Context Protocol) server that provides AI applications like Claude Desktop, Cursor, and Trae AI with seamless integration to WeChat Official Account APIs. The project implements MCP tools for managing WeChat media, drafts, and publishing functionality.

**Tech Stack**: Node.js 18+, TypeScript, MCP SDK, SQLite, Axios, Zod

## Essential Commands

### Development

```bash
# Build the project (cleans and compiles TypeScript)
npm run build

# Production build (with stricter tsconfig)
npm run build:prod

# Type checking without emitting files
npm run check

# Lint code
npm run lint

# Run tests
npm test
```

### Running the Server

```bash
# Development mode (direct with tsx)
npm run dev -- mcp -a <app_id> -s <app_secret>

# Start built server
node dist/src/cli.js mcp -a <app_id> -s <app_secret>

# Using npx (recommended for users)
npx wechat-official-account-mcp mcp -a <app_id> -s <app_secret>
```

### CLI Options

- `-a, --app-id <appId>`: WeChat App ID (required)
- `-s, --app-secret <appSecret>`: WeChat App Secret (required)
- `-m, --mode <mode>`: Transport mode - `stdio` (default) or `sse`
- `-p, --port <port>`: Port for SSE mode (default: 3000)

### Packaging & Release

```bash
# Local package testing
npm run pack:test

# Dry run pack (show what would be included)
npm run pack:dry

# Full build with verification
./scripts/build.sh
```

## Architecture

### Core Components

**Entry Points**:
- `src/cli.ts` - CLI entry point using Commander.js
- `src/index.ts` - Module exports for library usage

**MCP Server Layer** (`src/mcp-server/`):
- `shared/init.ts` - Server initialization logic (`initWechatMcpServer`, `initMcpServerWithTransport`)
- `shared/types.ts` - Server configuration types
- `transport/stdio.ts` - stdio transport for local MCP clients
- `transport/sse.ts` - SSE transport for remote/web clients

**Tool Layer** (`src/mcp-tool/`):
- `index.ts` - `WechatMcpTool` class that manages all MCP tools
- `types.ts` - Core type definitions (WechatConfig, AccessTokenInfo, MediaInfo, etc.)
- `tools/` - Individual tool implementations (auth-tool, media-upload-tool, draft-tool, etc.)

**Service Layer**:
- `src/auth/auth-manager.ts` - Manages WeChat credentials and Access Token lifecycle
- `src/wechat/api-client.ts` - Axios-based HTTP client with automatic token injection
- `src/storage/storage-manager.ts` - SQLite persistence with optional AES encryption

### Data Flow

1. CLI args → `McpServerOptions` → `initMcpServerWithTransport()`
2. Server creates `AuthManager` (handles credentials/token) and `WechatMcpTool` (tool registry)
3. Tools are registered to MCP server via `WechatMcpTool.registerTools()`
4. When a tool is called, handler receives `params` and `WechatApiClient`, returns `WechatToolResult`

### Tool Implementation Pattern

Each tool in `src/mcp-tool/tools/` follows this pattern:
```typescript
// 1. Define Zod schema for validation
const schema = z.object({
  action: z.enum(['action1', 'action2']),
  param: z.string().optional(),
});

// 2. Export McpTool with handler
export const toolName: McpTool = {
  name: 'tool_name',
  description: 'Tool description',
  inputSchema: { /* ZodRawShape */ },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const validated = schema.parse(params);
    // Execute logic
    return { content: [{ type: 'text', text: 'result' }] };
  }
};
```

### Security Features

- **Encryption**: Set `WECHAT_MCP_SECRET_KEY` environment variable to enable AES-256 encryption for sensitive fields (app_secret, token, encoding_aes_key, access_token)
- **CORS**: Configure `CORS_ORIGIN` as comma-separated whitelist for SSE mode (e.g., `https://domain1.com,https://domain2.com`)
- **Log Sanitization**: Error logs only include status codes/messages, never full response bodies or sensitive data
- **Token Management**: Access tokens auto-refresh 1 minute before expiry

### Storage Schema

SQLite database at `./data/wechat-mcp.db` with tables:
- `config` - App credentials (encrypted if secret key set)
- `access_tokens` - Token cache with expiry tracking
- `media` - Temporary media tracking
- `permanent_media` - Permanent material library
- `drafts` - Draft content storage
- `publishes` - Publication records

## MCP Tools Available

All tools are registered in `src/mcp-tool/tools/index.ts`:

1. **wechat_auth** - Configure auth, get/refresh tokens, view config
2. **wechat_media_upload** - Upload/get temporary media (images, voice, video, thumb)
3. **wechat_upload_img** - Upload article images (doesn't count toward material limit)
4. **wechat_permanent_media** - Manage permanent materials (add/get/delete/list/count)
5. **wechat_draft** - Draft CRUD operations (add/get/delete/list/count)
6. **wechat_publish** - Publish drafts and check status

## Important Implementation Notes

- **Module System**: Uses ES modules (`"type": "module"` in package.json) - must use `.js` extensions in imports
- **TypeScript Config**: Two configs - `tsconfig.json` for dev, `tsconfig.prod.json` for production builds
- **Path Aliases**: `@/*` maps to `./src/*` (configured in tsconfig.json)
- **Error Handling**: WeChat API errors always include `errcode` and `errmsg` fields
- **Media Uploads**: Use `form-data` library for multipart uploads
- **CLI Executable**: The `postbuild` script ensures `dist/src/cli.js` has executable permissions

## Testing & Quality

- Run `npm run check` before committing to catch type errors
- Use `npm run lint` to check code style (ESLint with TypeScript support)
- Build artifacts go to `dist/` directory and are gitignored

## Environment Variables

- `NODE_ENV` - Development/production mode
- `DEBUG` - Enable debug logging
- `CORS_ORIGIN` - Comma-separated CORS whitelist for SSE mode
- `WECHAT_MCP_SECRET_KEY` - AES encryption key for sensitive data storage
- `DB_PATH` - Custom database path (default: `./data/wechat-mcp.db`)

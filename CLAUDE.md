# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Official Account MCP (Model Context Protocol) server that provides AI applications like Claude Desktop, Cursor, and Trae AI with seamless integration to WeChat Official Account APIs. The project implements MCP tools for managing WeChat media, drafts, and publishing functionality.

**Tech Stack**: Node.js 20.17+, TypeScript, MCP SDK, SQLite, Axios, Zod, Express (for SSE transport), crypto-js (for encryption)

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
- `shared/types.ts` - Server configuration types (`McpServerOptions`)
- `transport/stdio.ts` - stdio transport for local MCP clients (default for Claude Desktop)
- `transport/sse.ts` - SSE (Server-Sent Events) transport for remote/web clients using Express

**Tool Layer** (`src/mcp-tool/`):
- `index.ts` - `WechatMcpTool` class that manages all MCP tools (tool registry, execution, error handling)
- `types.ts` - Core type definitions (WechatConfig, AccessTokenInfo, MediaInfo, McpTool, etc.)
- `tools/` - Individual tool implementations (auth-tool, media-upload-tool, draft-tool, etc.)

**Service Layer**:
- `src/auth/auth-manager.ts` - Manages WeChat credentials and Access Token lifecycle (with auto-refresh)
- `src/wechat/api-client.ts` - Axios-based HTTP client with automatic token injection via request interceptor
- `src/storage/storage-manager.ts` - SQLite persistence with optional AES-256 encryption

**Utilities** (`src/utils/`):
- `logger.ts` - Logging utility with debug/info/error levels
- `validation.ts` - Zod schemas and sanitization functions for input validation
- `db-init.ts` - Database initialization and schema management

### Data Flow

1. CLI args → `McpServerOptions` → `initMcpServerWithTransport()`
2. Server creates `AuthManager` (handles credentials/token) and `WechatMcpTool` (tool registry)
3. Tools are registered to MCP server via `WechatMcpTool.registerTools()`
4. When a tool is called, handler receives `params` and `WechatApiClient`, returns `WechatToolResult`

### Tool Implementation Pattern

Each tool in `src/mcp-tool/tools/` follows this pattern:
```typescript
// 1. Define Zod schema for validation (reuse schemas from utils/validation.ts when possible)
const schema = z.object({
  action: z.enum(['action1', 'action2']),
  param: z.string().optional(),
});

// 2. Export McpTool with handler
export const toolName: McpTool = {
  name: 'tool_name',
  description: 'Tool description',
  inputSchema: { /* ZodRawShape - directly passed to registerTool */ },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const validated = schema.parse(params);
    // Execute logic using apiClient methods
    return { content: [{ type: 'text', text: 'result' }] };
  }
};
```

**Key Points**:
- All tools are exported from `src/mcp-tool/tools/index.ts` as `mcpTools` array
- Tool handlers receive `(params, apiClient)` - `params` is the raw input, validate it with Zod
- Return format must match `WechatToolResult` with `content` array containing text/image/resource items
- The `WechatMcpTool.registerTools()` wraps handlers with error handling, returning formatted errors
- Use validation schemas from `utils/validation.ts` (e.g., `mediaIdSchema`, `appIdSchema`, `articleTitleSchema`)
- For file operations, use `isValidMediaType()` and `isValidFileSize()` from validation utilities

### Security Features

- **Encryption**: Set `WECHAT_MCP_SECRET_KEY` environment variable to enable AES-256 encryption for sensitive fields (app_secret, token, encoding_aes_key, access_token). Encrypted values are stored with `enc:` prefix in the database.
- **CORS**: Configure `CORS_ORIGIN` as comma-separated whitelist for SSE mode (e.g., `https://domain1.com,https://domain2.com`). **Never use `*` in production**.
- **Input Validation**: All tool inputs validated with Zod schemas; HTML content sanitized using `sanitizeHtmlContent()` to remove script tags, iframes, and event handlers
- **Log Sanitization**: Error logs only include status codes/messages, never full response bodies or sensitive data (see `src/wechat/api-client.ts` response interceptor)
- **Token Management**: Access tokens auto-refresh 1 minute before expiry; uses a promise lock (`refreshPromise`) to prevent concurrent refresh attempts
- **File Type Whitelisting**: Media uploads validated against `ALLOWED_MEDIA_TYPES` whitelist in `utils/validation.ts`

### Storage Schema

SQLite database at `./data/wechat-mcp.db` with tables:
- `config` - App credentials (encrypted if secret key set)
- `access_tokens` - Token cache with expiry tracking
- `media` - Temporary media tracking
- `permanent_media` - Permanent material library
- `drafts` - Draft content storage
- `publishes` - Publication records

## Tool Architecture

**Two layers — do not confuse them.**

- **Implementation layer** (`src/mcp-tool/tools/`, 22 tools): the original multiplexed tools (`wechat_draft` with `add/update/get/...`). These are **not registered with MCP clients**. They are dispatched by the registry.
- **Public surface** (`src/mcp-tool/public-tools.ts`, 14 tools): what clients actually see.

The public surface follows read/write separation, which Anthropic connector review treats as pass/fail:

| Kind | Tools |
| --- | --- |
| Meta | `search_actions`, `execute_read_action`, `execute_write_action` |
| Domain pairs | `wechat_{content,media,audience,engagement,messaging}_{read,write}` |
| Analytics | `wechat_statistics` (all read-only) |

`src/mcp-tool/registry.ts` holds the action catalog — **the single source of truth** for each of the 101 actions' mode (`r` read-only / `w` additive write / `d` destructive). Domain tools are *generated* from it; their action implementations and parameter schemas are reused from the implementation layer.

Rules when changing this:
- A new action must be registered in `ACTION_CATALOG`, or `npm test` fails.
- Never let a `*_read` tool expose a non-`r` action — `npm test` and `scripts/verify-mcp-protocol.mjs` both guard this, and `dispatchAction()` rejects it at runtime.
- Long-tail capabilities stay behind `search_actions` + `execute_*_action` rather than getting their own tool; this keeps the surface in the recommended 1–15 range.

## Important Implementation Notes

- **Module System**: Uses ES modules (`"type": "module"` in package.json) - **must use `.js` extensions in all imports**
- **TypeScript Config**: Two configs - `tsconfig.json` for dev (looser checks), `tsconfig.prod.json` for production builds (stricter)
- **Path Aliases**: `@/*` maps to `./src/*` (configured in tsconfig.json) - use this for cleaner imports
- **Error Handling**: WeChat API errors always include `errcode` and `errmsg` fields; errors are logged but not exposed in full to prevent data leakage
- **Media Uploads**: Use `form-data` library for multipart uploads; the API client handles the multipart construction
- **CLI Executable**: The `postbuild` script ensures `dist/src/cli.js` has executable permissions (`chmod +x`)
- **API Client Pattern**: The `WechatApiClient` class has automatic token injection via request interceptor - never manually add `access_token` to URLs
- **Storage**: SQLite database at `./data/wechat-mcp.db` (auto-created on first run); the `data/` directory is gitignored
- **Testing**: No Jest/Vitest suite exists. `npm test` runs `build:prod` then `test-tools.js`, which asserts tool registration (count/uniqueness/handler) and the stdio log-channel contract. `npm run verify` runs `scripts/verify-upgrade.mjs` (draft field mapping, cross-field validation, statistics date guard, publish status mapping)

## Testing & Quality

- Run `npm run check` before committing to catch type errors
- Use `npm run lint` to check code style (ESLint with TypeScript support)
- Build artifacts go to `dist/` directory and are gitignored

## Environment Variables

- `NODE_ENV` - Development/production mode (affects some logging behavior)
- `DEBUG` - Enable debug logging (set to `true` or `1`)
- `CORS_ORIGIN` - Comma-separated CORS whitelist for SSE mode (e.g., `https://domain1.com,https://domain2.com`)
- `WECHAT_MCP_SECRET_KEY` - AES encryption key for sensitive data storage (optional but strongly recommended for production)
- `DB_PATH` - Custom database path (default: `./data/wechat-mcp.db`)

## Common Patterns

### Adding a New Tool

1. Create a new file in `src/mcp-tool/tools/` (e.g., `new-tool.ts`)
2. Import necessary types and schemas:
   ```typescript
   import { z } from 'zod';
   import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
   import { logger } from '../../utils/logger.js';
   ```
3. Define your Zod schema (reuse existing schemas from `utils/validation.ts` when possible)
4. Export the tool implementing `McpTool` interface
5. Add to the `mcpTools` array in `src/mcp-tool/tools/index.ts`
6. **Register its annotations in `TOOL_ANNOTATIONS`** (same file). Required: `title`, `readOnlyHint`, `destructiveHint`. Anthropic connector review treats a missing annotation as a pass/fail failure. `npm test` fails if a tool has no annotation entry.

**Tool annotations**: `readOnlyHint: true` for tools that never modify remote data; `destructiveHint: true` for tools that can delete or overwrite existing remote content (as opposed to purely additive operations). These drive Claude's auto-permission behavior — read-only tools skip per-call confirmation, destructive tools always prompt.

### Error Response Format

All tool results should follow this format:
```typescript
return {
  content: [{
    type: 'text',
    text: 'Your result message here'
  }]
};
```

For errors, the `WechatMcpTool.registerTools()` wrapper automatically catches exceptions and returns:
```typescript
{
  isError: true,          // 必须置位，否则失败调用在协议层看起来是一次成功结果
  content: [{
    type: 'text',
    text: `Error: ${error.message}`
  }]
}
```

### Accessing WeChat API from a Tool

The `apiClient` parameter provides methods like:
- `uploadMedia()` - Upload temporary media
- `uploadImg()` - Upload article images (other material)
- `addPermanentMedia()` - Add permanent material
- `getPermanentMedia()` - Get permanent material
- `deletePermanentMedia()` - Delete permanent material
- `listPermanentMedia()` - List permanent materials
- `countPermanentMedia()` - Count materials by type
- `addDraft()` - Create draft
- `getDraft()` - Get draft details
- `deleteDraft()` - Delete draft
- `listDrafts()` - List drafts
- `countDrafts()` - Count drafts
- `publishDraft()` - Publish a draft
- `getPublishStatus()` - Check publish status

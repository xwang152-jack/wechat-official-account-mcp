import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AuthManager } from '../../auth/auth-manager.js';

export interface McpServerOptions {
  appId: string;
  appSecret: string;
  /** stdio（本地）/ http（远程，推荐）/ sse（已废弃，仅为兼容保留） */
  mode?: 'stdio' | 'http' | 'sse';
  host?: string;
  port?: string;
  tools?: string[];
  debug?: boolean;
  config?: string;
}

export interface NewServerResult {
  mcpServer: McpServer;
  authManager: AuthManager;
}

export type GetNewServerFunction = (options: McpServerOptions) => Promise<NewServerResult>;

export type InitTransportServerFunction = (
  getNewServer: GetNewServerFunction,
  options: McpServerOptions,
) => Promise<void>;
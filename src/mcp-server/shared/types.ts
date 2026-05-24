import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AuthManager } from '../../auth/auth-manager.js';

export interface McpServerOptions {
  appId: string;
  appSecret: string;
  mode?: 'stdio' | 'sse';
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
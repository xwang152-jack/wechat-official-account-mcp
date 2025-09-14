import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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

export type GetNewServerFunction = (options: McpServerOptions) => Promise<McpServer>;

export type InitTransportServerFunction = (
  getNewServer: GetNewServerFunction,
  options: McpServerOptions,
) => Promise<void>;
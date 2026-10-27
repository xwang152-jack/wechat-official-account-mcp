import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WechatMcpTool } from '../../mcp-tool/index.js';
import { SERVER_INSTRUCTIONS } from '../../mcp-tool/public-tools.js';
import { createAuthManager } from '../../auth/auth-manager.js';
import { initStdioServer, initSSEServer, initHttpServer } from '../transport/index.js';
import { McpServerOptions } from './types';
import { logger } from '../../utils/logger.js';
import { getVersion } from '../../utils/version.js';

export async function initWechatMcpServer(options: McpServerOptions) {
  const { appId, appSecret, tools } = options;

  if (!appId || !appSecret) {
    logger.error('Error: Missing App Credentials');
    throw new Error('Missing App Credentials');
  }

  // 创建MCP服务器
  // 注意：MCP SDK 1.20+ 的 ServerInfo 已移除 id 字段，仅保留 name/version
  const mcpServer = new McpServer(
    {
      name: 'WeChat Official Account MCP Server',
      version: getVersion()
    },
    {
      instructions: SERVER_INSTRUCTIONS
    }
  );

  // 创建认证管理器
  const authManager = await createAuthManager(appId, appSecret);

  // 创建微信MCP工具
  const wechatTool = new WechatMcpTool(authManager);
  
  // 初始化工具
  await wechatTool.initialize(tools);
  
  // 注册工具到MCP服务器
  wechatTool.registerTools(mcpServer);

  return { mcpServer, wechatTool, authManager };
}

export async function initMcpServerWithTransport(options: McpServerOptions) {
  const { mode = 'stdio' } = options;

  const getNewServer = async (commonOptions: McpServerOptions) => {
    const { mcpServer, authManager } = await initWechatMcpServer({ ...options, ...commonOptions });
    return { mcpServer, authManager };
  };

  switch (mode) {
    case 'stdio':
      await initStdioServer(getNewServer, options);
      break;
    case 'http':
      await initHttpServer(getNewServer, options);
      break;
    case 'sse':
      logger.warn(
        'SSE transport is deprecated by the MCP spec and has no authentication. ' +
        'Use --mode http instead.',
      );
      await initSSEServer(getNewServer, options);
      break;
    default:
      throw new Error('Invalid mode: ' + mode);
  }
}

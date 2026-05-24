import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WechatMcpTool } from '../../mcp-tool/index.js';
import { AuthManager } from '../../auth/auth-manager.js';
import { initStdioServer, initSSEServer } from '../transport/index.js';
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
  const mcpServer = new McpServer({
    id: 'wechat-mcp-server',
    name: 'WeChat Official Account MCP Server',
    version: getVersion()
  });

  // 创建认证管理器
  const authManager = new AuthManager();
  await authManager.initialize();
  await authManager.setConfig({ appId, appSecret });

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
    case 'sse':
      await initSSEServer(getNewServer, options);
      break;
    default:
      throw new Error('Invalid mode: ' + mode);
  }
}

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { InitTransportServerFunction } from '../shared/index.js';
import { logger } from '../shared/logger.js';

export const initStdioServer: InitTransportServerFunction = async (
  getNewServer,
  options,
) => {
  const { appId, appSecret } = options;

  if (!appId || !appSecret) {
    logger.error('Missing App ID or App Secret');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  const mcpServer = await getNewServer(options);

  logger.info(
    `[StdioServerTransport] Connecting to WeChat MCP Server, appId: ${appId}`,
  );
  
  await mcpServer.connect(transport);
};
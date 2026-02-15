import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { InitTransportServerFunction } from '../shared/index.js';
import { logger } from '../../utils/logger.js';

export const initStdioServer: InitTransportServerFunction = async (
  getNewServer,
  options,
) => {
  const { appId, appSecret } = options;

  if (!appId || !appSecret) {
    logger.error('Missing App ID or App Secret');
    process.exit(1);
  }

  try {
    const transport = new StdioServerTransport();
    const mcpServer = await getNewServer(options);

    logger.info(
      `[StdioServerTransport] Connecting to WeChat MCP Server, appId: ${appId.substring(0, 8)}...`,
    );

    await mcpServer.connect(transport);
  } catch (error) {
    logger.error('Failed to initialize stdio server:', error);
    process.exit(1);
  }
};

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in stdio server:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in stdio server:', reason);
  process.exit(1);
});
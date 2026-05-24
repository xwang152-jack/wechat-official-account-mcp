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
    const { mcpServer, authManager } = await getNewServer(options);

    logger.info(
      `[StdioServerTransport] Connecting to WeChat MCP Server, appId: ${appId.substring(0, 8)}...`,
    );

    await mcpServer.connect(transport);

    // 优雅关闭处理
    const shutdown = async (signal: string) => {
      logger.info(`[StdioServerTransport] Received ${signal}, shutting down gracefully...`);
      try {
        await authManager.dispose();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to initialize stdio server:', error);
    process.exit(1);
  }
};

import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { InitTransportServerFunction } from '../shared/index.js';
import { logger } from '../../utils/logger.js';

export const initSSEServer: InitTransportServerFunction = async (
  getNewServer,
  options,
) => {
  const { appId, appSecret, port = '3000' } = options;

  if (!appId || !appSecret) {
    logger.error('Missing App ID or App Secret');
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  // 错误处理中间件
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('SSE server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/sse', async (req, res) => {
    try {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Create SSE transport
      const transport = new SSEServerTransport("/messages", res);
      const mcpServer = await getNewServer(options);

      await mcpServer.connect(transport);

      req.on('close', async () => {
        try {
          logger.info('SSE connection closed, cleaning up...');
          // 这里可以添加清理逻辑
        } catch (error) {
          logger.error('Error during SSE cleanup:', error);
        }
      });

      req.on('error', (error) => {
        logger.error('SSE request error:', error);
      });
    } catch (error) {
      logger.error('Error in SSE handler:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to establish SSE connection' });
      }
    }
  });

  // 创建 HTTP 服务器
  const server = app.listen(port, () => {
    logger.info(`SSE server listening on port ${port}`);
  });

  // 处理服务器错误
  server.on('error', (error) => {
    logger.error('HTTP server error:', error);
  });

  logger.info(
    `[SSEServerTransport] Connecting to WeChat MCP Server, appId: ${appId.substring(0, 8)}...`,
  );

  // 优雅关闭处理
  const shutdown = async (signal: string) => {
    logger.info(`[SSEServerTransport] Received ${signal}, shutting down gracefully...`);

    try {
      // 停止接受新连接
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // 如果5秒后还没关闭,强制退出
      setTimeout(() => {
        logger.warn('Forcing shutdown after timeout');
        process.exit(1);
      }, 5000);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // 捕获未处理的异常
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
};
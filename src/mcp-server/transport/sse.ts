import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { InitTransportServerFunction } from '../shared/index.js';
import { logger } from '../shared/logger.js';

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

  app.get('/sse', async (req, res) => {
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

    req.on('close', () => {
      server.close();
    });
  });

  // 创建 HTTP 服务器
  const server = app.listen(port, () => {
    logger.info(`SSE server listening on port ${port}`);
  });

  logger.info(
    `[SSEServerTransport] Connecting to WeChat MCP Server, appId: ${appId}`,
  );

  process.on('SIGINT', () => {
    logger.info('[SSEServerTransport] Shutting down server...');
    server.close();
    process.exit(0);
  });
};
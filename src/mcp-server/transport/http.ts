import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InitTransportServerFunction } from '../shared/index.js';
import { AuthManager } from '../../auth/auth-manager.js';
import { logger } from '../../utils/logger.js';

/**
 * Streamable HTTP 传输（MCP 规范当前推荐的远程传输）
 *
 * 取代已废弃的 SSE 传输。默认按**无状态**方式工作：每个请求建一个独立的
 * server + transport，请求结束即回收，不跨请求保存会话。
 *
 * 部署形态是**单租户自托管**：部署者自己持有 appId/appSecret，通过环境变量或
 * CLI 传入。这与微信的 IP 白名单约束天然契合——部署者把自己的服务器出口 IP
 * 加进公众号后台即可，无需第三方代持凭据。
 */
export const initHttpServer: InitTransportServerFunction = async (
  getNewServer,
  options,
) => {
  const { port = '3000', host = '0.0.0.0' } = options;
  const httpToken = process.env.MCP_HTTP_TOKEN;

  const app = express();
  // 微信图文正文可能较大，放宽请求体上限
  app.use(express.json({ limit: '4mb' }));

  // ---- CORS ----
  // 生产环境必须显式配置 CORS_ORIGIN（逗号分隔白名单）；未配置时仅允许同源访问，
  // 不使用通配符，避免任意站点携带凭据调用本服务。
  const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // ---- 鉴权 ----
  // 设置 MCP_HTTP_TOKEN 后，所有 /mcp 请求必须带 `Authorization: Bearer <token>`。
  // 本服务持有公众号凭据，暴露到公网时**应当**设置该变量。
  if (!httpToken) {
    logger.warn(
      'MCP_HTTP_TOKEN is not set — the HTTP endpoint is unauthenticated. ' +
      'Set it before exposing this server beyond localhost.',
    );
  }

  const requireAuth: express.RequestHandler = (req, res, next) => {
    if (!httpToken) {
      next();
      return;
    }
    const header = req.headers.authorization ?? '';
    const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
    // 定长比较，避免计时侧信道
    if (presented.length !== httpToken.length || presented !== httpToken) {
      logger.warn('Rejected HTTP request with missing or invalid bearer token');
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  };

  // ---- 健康检查 ----（不鉴权，供负载均衡/探活使用）
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', server: 'wechat-mcp' });
  });

  // ---- MCP 端点 ----
  app.post('/mcp', requireAuth, async (req, res) => {
    let authManager: AuthManager | null = null;
    try {
      const { mcpServer, authManager: am } = await getNewServer(options);
      authManager = am;

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // 无状态
      });

      res.on('close', () => {
        void transport.close();
        void authManager?.dispose();
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // 无状态模式下不存在可恢复的会话，GET/DELETE 一律拒绝
  const methodNotAllowed: express.RequestHandler = (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed in stateless mode.' },
      id: null,
    });
  };
  app.get('/mcp', requireAuth, methodNotAllowed);
  app.delete('/mcp', requireAuth, methodNotAllowed);

  // ---- 启动 ----
  const server = app.listen(Number(port), host, () => {
    logger.info(`Streamable HTTP server listening on ${host}:${port}`);
    logger.info(`  MCP endpoint: http://${host}:${port}/mcp`);
    logger.info(`  Auth: ${httpToken ? 'bearer token required' : '⚠️  NONE (set MCP_HTTP_TOKEN)'}`);
  });

  server.on('error', (error) => {
    logger.error('HTTP server error:', error);
  });

  // ---- 优雅关闭 ----
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

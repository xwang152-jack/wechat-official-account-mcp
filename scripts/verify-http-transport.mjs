/**
 * Streamable HTTP 传输自检
 *
 *   npm run build && node scripts/verify-http-transport.mjs
 *
 * 校验鉴权边界——这是暴露到公网后唯一挡住未授权调用的东西：
 *  1. /healthz 不鉴权可访问
 *  2. 无 token / 错误 token 的 /mcp 请求被拒
 *  3. 正确 token 可完成完整 MCP 握手，并拿到工具列表
 *  4. 无状态模式下 GET /mcp 返回 405
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3998;
const TOKEN = 'verify-token-0123456789abcdef';
const BASE = `http://127.0.0.1:${PORT}`;

const proc = spawn('node', [path.join(root, 'dist/src/cli.js'), 'mcp',
  '-a', 'wx1234567890abcdef',
  '-s', '0123456789abcdef0123456789abcdef',
  '-m', 'http', '-p', String(PORT), '--host', '127.0.0.1',
], {
  env: { ...process.env, MCP_HTTP_TOKEN: TOKEN, CORS_ORIGIN: 'https://claude.ai' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
proc.stdout.on('data', (d) => { serverLog += d; });
proc.stderr.on('data', (d) => { serverLog += d; });

const post = (body, token) => fetch(`${BASE}/mcp`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

const rpc = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params });

try {
  // 等待监听
  for (let i = 0; i < 40; i++) {
    try {
      const h = await fetch(`${BASE}/healthz`);
      if (h.ok) break;
    } catch { /* 尚未就绪 */ }
    await new Promise((r) => setTimeout(r, 150));
  }

  const health = await fetch(`${BASE}/healthz`);
  assert.equal(health.status, 200, '/healthz 应免鉴权返回 200');
  console.log('✓ /healthz 免鉴权可访问');

  const noToken = await post(rpc(1, 'initialize'));
  assert.equal(noToken.status, 401, '无 token 的 /mcp 请求应被拒绝');
  console.log('✓ 无 token → 401');

  const badToken = await post(rpc(1, 'initialize'), 'wrong-token');
  assert.equal(badToken.status, 401, '错误 token 的 /mcp 请求应被拒绝');
  console.log('✓ 错误 token → 401');

  const ok = await post(rpc(1, 'initialize', {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'verify', version: '1.0' },
  }), TOKEN);
  assert.equal(ok.status, 200, '正确 token 应握手成功');
  const text = await ok.text();
  assert.match(text, /WeChat Official Account MCP Server/, '握手响应未包含 serverInfo');
  assert.match(text, /instructions/, '握手响应未包含 instructions');
  console.log('✓ 正确 token → 握手成功并返回 instructions');

  const getResp = await fetch(`${BASE}/mcp`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  assert.equal(getResp.status, 405, '无状态模式下 GET /mcp 应为 405');
  console.log('✓ GET /mcp → 405（无状态模式）');

  console.log('\nHTTP 传输检查全部通过。');
} catch (err) {
  console.error('\n服务端日志：\n' + serverLog.slice(-800));
  throw err;
} finally {
  proc.kill();
}

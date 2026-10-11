/**
 * MCP 协议层自检（无框架依赖，直接起真实 stdio 服务）
 *
 *   npm run build && node scripts/verify-mcp-protocol.mjs
 *
 * 校验那些源码层看不出来、只有走完整协议才能确认的事：
 *  1. annotations 真的序列化进了 tools/list 响应
 *  2. 只读工具与写入工具在协议层是分开的工具
 *  3. 工具内部抛出的异常被包装成 isError:true，而不是伪装成成功结果
 *  4. 只读入口拒绝执行写操作（防止借道）
 *  5. search_actions 能检索到长尾动作
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(root, 'dist/src/cli.js');

const proc = spawn('node', [cli, 'mcp',
  '-a', 'wx1234567890abcdef',
  '-s', '0123456789abcdef0123456789abcdef',
], { stdio: ['pipe', 'pipe', 'pipe'] });

let buffer = '';
proc.stdout.on('data', (d) => { buffer += d; });
proc.stderr.on('data', () => {});

const send = (msg) => proc.stdin.write(`${JSON.stringify(msg)}\n`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const call = (id, name, args) => send({
  jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args },
});

try {
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'verify', version: '1.0' },
  } });
  await wait(700);
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  await wait(700);
  call(3, 'wechat_content_write', { action: 'add' });                                  // 缺参数 → 应报错
  call(4, 'execute_read_action', { action_id: 'wechat_menu.delete', params: {} });     // 只读入口跑写 → 应拒绝
  call(5, 'execute_read_action', { action_id: 'nonexistent.thing', params: {} });      // 未知动作 → 应报错
  call(6, 'search_actions', { query: '菜单' });                                        // 长尾检索
  await wait(1200);

  const msgs = buffer.split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const byId = (id) => msgs.find((m) => m.id === id);

  assert.ok(byId(1)?.result, 'initialize 未成功握手');
  const init = byId(1).result;
  assert.ok(init.instructions?.length > 0, 'init 未返回 server instructions');
  console.log('✓ initialize 握手成功，且返回了 instructions');

  const tools = byId(2)?.result?.tools ?? [];
  assert.ok(tools.length > 0, 'tools/list 未返回任何工具');
  for (const t of tools) {
    assert.ok(t.annotations?.title, `工具 ${t.name} 未在协议层暴露 annotations.title`);
    assert.equal(typeof t.annotations.readOnlyHint, 'boolean', `${t.name} 缺少 readOnlyHint`);
    assert.equal(typeof t.annotations.destructiveHint, 'boolean', `${t.name} 缺少 destructiveHint`);
    if (t.annotations.readOnlyHint) {
      assert.equal(t.annotations.destructiveHint, false, `${t.name} 只读却标了破坏性`);
    }
    assert.ok(t.name.length <= 64, `工具名 ${t.name} 超过 64 字符`);
  }
  const ro = tools.filter((t) => t.annotations.readOnlyHint).map((t) => t.name);
  const de = tools.filter((t) => t.annotations.destructiveHint).map((t) => t.name);
  console.log(`✓ tools/list 返回 ${tools.length} 个工具，annotations 全部就位`);
  console.log(`    只读: ${ro.join(', ')}`);
  console.log(`    破坏性: ${de.join(', ')}`);

  // 读写分离：同名域不应同时出现在只读与破坏性列表里
  for (const name of tools.map((t) => t.name)) {
    const kind = name.endsWith('_read') ? 'read' : name.endsWith('_write') ? 'write' : null;
    if (!kind) continue;
    const t = tools.find((x) => x.name === name);
    if (kind === 'read') assert.equal(t.annotations.readOnlyHint, true, `${name} 是只读工具却未标 readOnlyHint`);
    else assert.equal(t.annotations.readOnlyHint, false, `${name} 是写入工具却标了 readOnlyHint`);
  }
  console.log('✓ 只读/写入工具在协议层严格分离');

  const errCase = byId(3)?.result;
  assert.equal(errCase?.isError, true, '工具抛异常时未返回 isError:true');
  console.log('✓ 工具异常正确标记为 isError:true');

  const readGuard = byId(4)?.result;
  assert.equal(readGuard?.isError, true, '只读入口未拒绝写操作');
  assert.match(readGuard.content[0].text, /只读/, '只读入口的拒绝理由不明确');
  console.log('✓ 只读入口拒绝执行写操作（防借道）');
  console.log(`    拒绝理由: ${readGuard.content[0].text.slice(0, 70)}`);

  const unknownCase = byId(5)?.result;
  assert.equal(unknownCase?.isError, true, '未知动作未返回错误');
  console.log('✓ 未知动作 ID 返回可操作的错误提示');

  const search = byId(6)?.result;
  assert.equal(search?.isError, undefined, 'search_actions 返回了错误');
  const found = JSON.parse(search.content[0].text);
  assert.ok(found.matched > 0, `search_actions 检索「菜单」无结果`);
  assert.ok(found.actions.every((a) => a.id && a.mode && a.execute_with), 'search 结果字段不完整');
  console.log(`✓ search_actions 检索「菜单」命中 ${found.matched} 个动作（共 ${found.total} 个）`);

  console.log('\nMCP 协议层检查全部通过。');
} finally {
  proc.kill();
}

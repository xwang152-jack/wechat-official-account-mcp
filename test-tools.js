// 工具注册与架构合规性检查
import { mcpTools } from './dist/src/mcp-tool/tools/index.js';
import { PUBLIC_TOOLS, PUBLIC_ANNOTATIONS } from './dist/src/mcp-tool/public-tools.js';
import { ACTION_CATALOG } from './dist/src/mcp-tool/registry.js';
import { logger } from './dist/src/utils/logger.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('=== MCP工具注册验证 ===');
console.log(`对外暴露的工具: ${PUBLIC_TOOLS.length} 个（实现层保留 ${mcpTools.length} 个原工具）`);
console.log('\n已注册的工具列表:');

PUBLIC_TOOLS.forEach((tool, index) => {
  const a = PUBLIC_ANNOTATIONS[tool.name];
  const tag = a?.readOnlyHint ? '只读' : a?.destructiveHint ? '破坏性' : '写入';
  console.log(`${index + 1}. ${tool.name} [${tag}] - ${tool.description.slice(0, 60)}...`);
});

console.log('\n=== 验证结果 ===');
const names = PUBLIC_TOOLS.map((tool) => tool.name);
assert(PUBLIC_TOOLS.length > 0, '至少应注册一个工具');
assert(new Set(names).size === names.length, `工具名存在重复: ${names.join(', ')}`);
PUBLIC_TOOLS.forEach((tool) => {
  assert(typeof tool.handler === 'function', `工具 ${tool.name} 缺少 handler`);
});
console.log(`✅ 成功！共 ${PUBLIC_TOOLS.length} 个工具，名称唯一且均含 handler`);

// ---- 注解完整性（Anthropic connector 审核 pass/fail 项）----
const missing = names.filter((n) => !PUBLIC_ANNOTATIONS[n]);
assert(missing.length === 0, `以下工具缺少注解: ${missing.join(', ')}`);
const extra = Object.keys(PUBLIC_ANNOTATIONS).filter((n) => !names.includes(n));
assert(extra.length === 0, `注解表中存在未注册的工具: ${extra.join(', ')}`);
for (const [name, a] of Object.entries(PUBLIC_ANNOTATIONS)) {
  assert(typeof a.title === 'string' && a.title.length > 0, `${name} 缺少 title`);
  assert(a.title.length <= 64, `${name} 的 title 超过 64 字符`);
  assert(typeof a.readOnlyHint === 'boolean', `${name} 缺少 readOnlyHint`);
  assert(typeof a.destructiveHint === 'boolean', `${name} 缺少 destructiveHint`);
  if (a.readOnlyHint) {
    assert(a.destructiveHint === false, `${name} 标记为只读时不应同时标记为破坏性`);
  }
}
const readOnly = Object.values(PUBLIC_ANNOTATIONS).filter((a) => a.readOnlyHint).length;
const destructive = Object.values(PUBLIC_ANNOTATIONS).filter((a) => a.destructiveHint).length;
console.log(`✅ 注解完整！只读 ${readOnly} / 破坏性 ${destructive} / 其余 ${names.length - readOnly - destructive}`);

// ---- 读写分离：只读工具的 action 必须全部是只读动作 ----
for (const tool of PUBLIC_TOOLS) {
  const opts = tool.inputSchema?.action?._def?.values;
  const actions = Array.isArray(opts) ? opts : null;
  if (!actions) continue;

  const modes = actions.map((a) => {
    const spec = ACTION_CATALOG.find((s) => s.action === a && names.includes(tool.name) && s.tool);
    return spec?.mode;
  });

  if (PUBLIC_ANNOTATIONS[tool.name].readOnlyHint) {
    const nonRead = actions.filter((a, i) => modes[i] !== undefined && modes[i] !== 'r');
    assert(nonRead.length === 0, `只读工具 ${tool.name} 含非只读 action: ${nonRead.join(', ')}`);
  }
}
console.log('✅ 读写分离！所有只读工具不含任何写操作');

// ---- 动作目录覆盖完整性：实现层每个工具的每个 action 都必须在目录中登记 ----
let catalogGaps = [];
for (const tool of mcpTools) {
  const opts = tool.inputSchema?.action?._def?.values;
  const actions = Array.isArray(opts) ? opts : null;
  if (!actions) {
    if (!ACTION_CATALOG.some((s) => s.id === tool.name)) catalogGaps.push(`${tool.name}（单操作工具未登记）`);
    continue;
  }
  for (const a of actions) {
    if (!ACTION_CATALOG.some((s) => s.tool === tool.name && s.action === a)) {
      catalogGaps.push(`${tool.name}.${a}`);
    }
  }
}
assert(catalogGaps.length === 0, `以下动作未登记到 ACTION_CATALOG: ${catalogGaps.join(', ')}`);
const byMode = { r: 0, w: 0, d: 0 };
ACTION_CATALOG.forEach((s) => { byMode[s.mode]++; });
console.log(`✅ 目录完整！共 ${ACTION_CATALOG.length} 个动作（只读 ${byMode.r} / 新增写 ${byMode.w} / 破坏性 ${byMode.d}）`);

console.log('\n=== 日志输出通道验证 ===');
const originalLog = console.log;
const originalError = console.error;
const stdoutLogs = [];
const stderrLogs = [];

try {
  console.log = (...args) => {
    stdoutLogs.push(args);
  };
  console.error = (...args) => {
    stderrLogs.push(args);
  };

  logger.info('stdio transport log channel smoke test');
} finally {
  console.log = originalLog;
  console.error = originalError;
}

assert(stdoutLogs.length === 0, 'logger 不应向 stdout 写日志，避免污染 MCP stdio 协议流');
assert(stderrLogs.length === 1, 'logger 应该向 stderr 写出一条日志');
console.log('✅ 成功！logger 日志只写入 stderr，不污染 stdout');

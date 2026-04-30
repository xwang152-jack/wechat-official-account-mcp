// 简单测试脚本验证工具注册
import { mcpTools } from './dist/src/mcp-tool/tools/index.js';
import { logger } from './dist/src/utils/logger.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('=== MCP工具注册验证 ===');
console.log(`总共注册的工具数量: ${mcpTools.length}`);
console.log('\n已注册的工具列表:');

mcpTools.forEach((tool, index) => {
  console.log(`${index + 1}. ${tool.name} - ${tool.description}`);
});

console.log('\n=== 验证结果 ===');
if (mcpTools.length === 15) {
  console.log('✅ 成功！所有15个工具都已正确注册为MCP工具');
} else {
  console.log(`❌ 失败！期望15个工具，实际注册了${mcpTools.length}个工具`);
}

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

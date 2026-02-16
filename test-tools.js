// 简单测试脚本验证工具注册
import { mcpTools } from './dist/src/mcp-tool/tools/index.js';

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

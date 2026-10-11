import { McpTool, McpToolAnnotations } from './types.js';
import { statisticsMcpTool } from './tools/statistics-tool.js';
import { metaTools, META_ANNOTATIONS } from './tools/meta-tools.js';
import { domainTools, DOMAIN_ANNOTATIONS } from './domains.js';

/**
 * 对外暴露的工具面（14 个）
 *
 * 架构：
 *   - 高频业务域 → 每域拆成 `*_read` / `*_write` 一对，读写严格分离
 *   - 长尾能力   → 由 search_actions 检索 + execute_read_action /
 *                  execute_write_action 执行
 *   - 数据统计   → 本身全部只读，保持独立工具
 *
 * 注意：`src/mcp-tool/tools/index.ts` 里的 22 个原工具仍是**实现层**，
 * 由 registry 分发复用，不直接注册给 MCP 客户端。
 */
export const PUBLIC_TOOLS: McpTool[] = [
  ...metaTools,
  ...domainTools,
  statisticsMcpTool,
];

/** 公开工具注解表 */
export const PUBLIC_ANNOTATIONS: Record<string, McpToolAnnotations> = {
  ...META_ANNOTATIONS,
  ...DOMAIN_ANNOTATIONS,
  wechat_statistics: {
    title: '数据统计分析',
    readOnlyHint: true,
    destructiveHint: false,
  },
};

/** 服务端 instructions —— 告诉客户端这套「域工具 + 目录检索」架构怎么用 */
export const SERVER_INSTRUCTIONS = [
  '微信公众号 MCP 服务。工具分三类：',
  '1. 高频业务域工具，成对出现：`wechat_content_read`/`wechat_content_write`、`wechat_media_read`/`wechat_media_write`、',
  '   `wechat_audience_read`/`wechat_audience_write`、`wechat_engagement_read`/`wechat_engagement_write`、',
  '   `wechat_messaging_read`/`wechat_messaging_write`、以及只读的 `wechat_statistics`。',
  '   每个域工具用一个 `action` 参数选择具体操作，action 的取值与含义见该工具的 action 描述。',
  '2. 长尾能力（菜单、二维码、短链、客服账号、账号配额、自动回复、商品卡片、认证配置等）没有独立工具，',
  '   先用 `search_actions` 按关键词检索得到动作 ID，再用 `execute_read_action`（只读）或',
  '   `execute_write_action`（写入）执行。',
  '3. 只读工具不会修改任何数据；写入工具会改变公众号上的内容，其中标记为破坏性的操作不可逆。',
  '所有工具返回 JSON。首次使用需先配置凭据：search_actions 检索 "认证"，再用 execute_write_action 执行 `wechat_auth.configure`。',
].join('\n');

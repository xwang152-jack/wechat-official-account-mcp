import { z } from 'zod';
import { McpTool, McpToolAnnotations, WechatApiClient, WechatToolResult } from '../types.js';
import { dispatchAction, searchActions, getActionSpec, ACTION_CATALOG } from '../registry.js';
import { jsonResult, failureResult } from '../json-result.js';

/**
 * search_actions —— 检索本服务支持的全部动作
 *
 * 长尾能力（菜单、二维码、短链、客服账号、账号配额、自动回复、商品卡片等）
 * 不单独建工具，统一从这里检索后用 execute_read_action / execute_write_action 执行。
 */
export const searchActionsTool: McpTool = {
  name: 'search_actions',
  description:
    '检索微信公众号服务支持的动作，返回动作 ID、读写模式与说明。' +
    '用于查找未单独建工具的长尾能力（菜单、二维码、短链、客服账号、账号配额、自动回复、商品卡片、认证配置等）。' +
    '本工具不修改任何数据，不调用微信接口。返回 JSON。',
  inputSchema: {
    query: z.string().min(1).describe('检索关键词，支持中英文，多个关键词以空格分隔（AND 语义），例如「菜单」「统计 阅读」「comment」'),
    mode: z.enum(['r', 'w', 'd']).optional()
      .describe('按读写模式过滤：r=只读，w=新增写入，d=破坏性操作。省略则返回全部模式'),
    limit: z.number().int().min(1).max(50).default(20).describe('返回条数上限，默认 20，最大 50'),
  },
  handler: async (params: unknown): Promise<WechatToolResult> => {
    const { query, mode, limit } = z.object({
      query: z.string().min(1),
      mode: z.enum(['r', 'w', 'd']).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }).parse(params);

    const found = searchActions(query, { mode, limit });

    return jsonResult({
      query,
      total: ACTION_CATALOG.length,
      matched: found.length,
      actions: found.map((s) => ({
        id: s.id,
        mode: s.mode,
        mode_label: s.mode === 'r' ? '只读' : s.mode === 'w' ? '写入(仅新增)' : '破坏性(删除/覆盖)',
        summary: s.summary,
        execute_with: s.mode === 'r' ? 'execute_read_action' : 'execute_write_action',
      })),
      ...(found.length === 0
        ? { hint: '无匹配。可改用更短的关键词，或省略关键词按 mode 过滤。' }
        : {}),
    });
  },
};

function makeExecutor(kind: 'read' | 'write'): McpTool {
  const isRead = kind === 'read';

  return {
    name: isRead ? 'execute_read_action' : 'execute_write_action',
    description:
      (isRead
        ? '执行一个只读动作（不会修改任何数据）。先用 search_actions 找到动作 ID。'
        : '执行一个写入动作（会改变公众号上的数据，部分操作不可逆）。先用 search_actions 找到动作 ID。') +
      `只接受 ${isRead ? '模式为 r（只读）' : '模式为 w 或 d（写入）'} 的动作；传入不匹配的动作会被拒绝。返回 JSON。`,
    inputSchema: {
      action_id: z.string().min(1)
        .describe('动作 ID，形如 wechat_menu.create。从 search_actions 的返回中获取'),
      params: z.record(z.unknown()).optional()
        .describe('该动作的业务参数对象。各参数含义见该动作所属工具的说明；省略则为空对象'),
    },
    handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
      const { action_id, params: actionParams } = z.object({
        action_id: z.string().min(1),
        params: z.record(z.unknown()).optional(),
      }).parse(params);

      const spec = getActionSpec(action_id);
      if (!spec) {
        return failureResult(
          `未知动作 ID '${action_id}'`,
          { hint: '请先调用 search_actions 检索可用动作' }
        );
      }

      return dispatchAction(action_id, actionParams ?? {}, apiClient, kind);
    },
  };
}

export const executeReadActionTool = makeExecutor('read');
export const executeWriteActionTool = makeExecutor('write');

/** 元工具注解表 */
export const META_ANNOTATIONS: Record<string, McpToolAnnotations> = {
  search_actions: {
    title: '检索可用动作',
    readOnlyHint: true,
    destructiveHint: false,
  },
  execute_read_action: {
    title: '执行只读动作',
    readOnlyHint: true,
    destructiveHint: false,
  },
  execute_write_action: {
    title: '执行写入动作',
    readOnlyHint: false,
    destructiveHint: true,
  },
};

export const metaTools: McpTool[] = [
  searchActionsTool,
  executeReadActionTool,
  executeWriteActionTool,
];

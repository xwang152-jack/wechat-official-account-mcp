import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { jsonResult } from '../json-result.js';

export const autoReplyMcpTool: McpTool = {
  name: 'wechat_auto_reply',
  description: '微信公众号自动回复规则 - 查询当前的自动回复规则配置',
  inputSchema: {
    action: z.enum([
      'get_current_info'
    ]),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    const validated = parseAutoReplyParams(params);

    switch (validated.action) {
      case 'get_current_info': {
        const result = await apiClient.getCurrentAutoReplyInfo();

        return jsonResult({
          action: 'get_current_info',
          addFriendReply: {
            enabled: !!result.isAddFriendReply,
            type: result.addFriendReplyInfo?.type ?? null,
            content: result.addFriendReplyInfo?.content ?? null,
          },
          messageReply: {
            enabled: !!result.isAutoReply,
            defaultReplies: (result.defaultMessageReplyInfoList ?? []).map(reply => ({
              type: reply.type,
              content: reply.content,
            })),
          },
          keywordReplies: (result.keywordAutoreplyInfoList ?? []).map(keywordReply => ({
            keyword: keywordReply.keyword,
            matchMode: keywordReply.matchMode === 0 ? 'full' : 'partial',
            replyCount: keywordReply.replyListInfo?.length ?? 0,
          })),
        });
      }

      default:
        throw new Error(`未知的操作: ${validated.action}`);
    }
  }
};

// 参数解析辅助函数
function parseAutoReplyParams(params: unknown) {
  return z.object({
    action: z.enum([
      'get_current_info'
    ]),
  }).parse(params);
}

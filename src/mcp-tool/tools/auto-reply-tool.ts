import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

export const autoReplyMcpTool: McpTool = {
  name: 'wechat_auto_reply',
  description: '微信公众号自动回复规则 - 查询当前的自动回复规则配置',
  inputSchema: {
    action: z.enum([
      'get_current_info'
    ]),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    try {
      const validated = parseAutoReplyParams(params);

      switch (validated.action) {
        case 'get_current_info': {
          const result = await apiClient.getCurrentAutoReplyInfo();

          let response = `自动回复规则配置:\n\n`;

          // 关注后回复
          response += `关注后自动回复: ${result.isAddFriendReply ? '已开启' : '未开启'}\n`;
          if (result.addFriendReplyInfo) {
            response += `  - 类型: ${result.addFriendReplyInfo.type}\n`;
            response += `  - 内容: ${result.addFriendReplyInfo.content}\n`;
          }
          response += `\n`;

          // 消息自动回复
          response += `消息自动回复: ${result.isAutoReply ? '已开启' : '未开启'}\n`;
          if (result.defaultMessageReplyInfoList && result.defaultMessageReplyInfoList.length > 0) {
            response += `  默认回复:\n`;
            result.defaultMessageReplyInfoList.forEach((reply, index) => {
              response += `    ${index + 1}. 类型: ${reply.type}, 内容: ${reply.content}\n`;
            });
          }
          response += `\n`;

          // 关键词回复
          if (result.keywordAutoreplyInfoList && result.keywordAutoreplyInfoList.length > 0) {
            response += `关键词自动回复 (共 ${result.keywordAutoreplyInfoList.length} 条):\n`;
            result.keywordAutoreplyInfoList.forEach((keywordReply, index) => {
              response += `  ${index + 1}. 关键词: ${keywordReply.keyword}\n`;
              response += `     匹配模式: ${keywordReply.matchMode === 0 ? '全匹配' : '半匹配'}\n`;
              response += `     回复: ${keywordReply.replyListInfo?.length || 0} 条\n`;
            });
          }

          return {
            content: [{
              type: 'text',
              text: response
            }]
          };
        }

        default:
          throw new Error(`未知的操作: ${validated.action}`);
      }
    } catch (error) {
      logger.error('Auto reply tool error:', error);
      throw error;
    }
  }
};

// 参数解析辅助函数
function parseAutoReplyParams(params: unknown): any {
  return params as any;
}

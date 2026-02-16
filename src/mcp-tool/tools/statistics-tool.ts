import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// 验证 Schema
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确，应为YYYY-MM-DD');

export const statisticsMcpTool: McpTool = {
  name: 'wechat_statistics',
  description: '微信公众号数据统计分析 - 获取图文、消息、接口等数据分析',
  inputSchema: {
    action: z.enum([
      'get_article_summary',
      'get_article_total',
      'get_user_read',
      'get_user_share',
      'get_upstream_message',
      'get_interface_summary',
      'get_interface_summary_hour'
    ]),
    beginDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    try {
      const validated = parseStatisticsParams(params);

      // 大多数统计接口都需要日期参数
      if (validated.action !== 'get_interface_summary' && validated.action !== 'get_interface_summary_hour') {
        if (!validated.beginDate || !validated.endDate) {
          throw new Error(`${validated.action} 操作需要 beginDate 和 endDate 参数`);
        }
      }

      switch (validated.action) {
        case 'get_article_summary': {
          const result = await apiClient.getArticleSummary(validated.beginDate, validated.endDate);
          const summary = result.list.map(item =>
            `${item.refDate}:\n` +
            `  - 图文页阅读人数: ${item.intPageReadUser}\n` +
            `  - 图文页阅读次数: ${item.intPageReadCount}\n` +
            `  - 原文页阅读人数: ${item.oriPageReadUser}\n` +
            `  - 原文页阅读次数: ${item.oriPageReadCount}\n` +
            `  - 分享人数: ${item.shareUser}\n` +
            `  - 分享次数: ${item.shareCount}\n` +
            `  - 收藏人数: ${item.addToFavUser}\n` +
            `  - 收藏次数: ${item.addToFavCount}`
          ).join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `图文群发每日数据 (${validated.beginDate} 至 ${validated.endDate}):\n\n${summary}`
            }]
          };
        }

        case 'get_article_total': {
          const result = await apiClient.getArticleTotal(validated.beginDate, validated.endDate);
          const total = result.list.map(item =>
            `${item.refDate}:\n` +
            `  - 来源: ${item.userSource}\n` +
            `  - 阅读人数: ${item.readUser}\n` +
            `  - 阅读次数: ${item.readCount}\n` +
            `  - 分享人数: ${item.shareUser}\n` +
            `  - 分享次数: ${item.shareCount}`
          ).join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `图文群发总数据 (${validated.beginDate} 至 ${validated.endDate}):\n\n${total}`
            }]
          };
        }

        case 'get_user_read': {
          const result = await apiClient.getUserRead(validated.beginDate, validated.endDate);
          const read = result.list.map(item =>
            `${item.refDate}:\n` +
            `  - 图文页阅读人数: ${item.intPageReadUser}\n` +
            `  - 图文页阅读次数: ${item.intPageReadCount}\n` +
            `  - 原文页阅读人数: ${item.oriPageReadUser}\n` +
            `  - 原文页阅读次数: ${item.oriPageReadCount}\n` +
            `  - 分享/收藏人数: ${item.shareUser}/${item.addToFavUser}\n` +
            `  - 分享/收藏次数: ${item.shareCount}/${item.addToFavCount}`
          ).join('\n\n');

          return {
            content: [{
              type: 'text',
              text: `图文统计数据 (${validated.beginDate} 至 ${validated.endDate}):\n\n${read}`
            }]
          };
        }

        case 'get_user_share': {
          const result = await apiClient.getUserShare(validated.beginDate, validated.endDate);
          const share = result.list.map(item =>
            `${item.refDate}:\n` +
            `  - 分享人数: ${item.shareUser}\n` +
            `  - 分享次数: ${item.shareCount}`
          ).join('\n');

          return {
            content: [{
              type: 'text',
              text: `图文分享转发数据 (${validated.beginDate} 至 ${validated.endDate}):\n\n${share}`
            }]
          };
        }

        case 'get_upstream_message': {
          const result = await apiClient.getUpstreamMessage(validated.beginDate, validated.endDate);
          const message = result.list.map(item =>
            `${item.refDate}:\n` +
            `  - 消息类型: ${item.msgType}\n` +
            `  - 上报发送用户数: ${item.msgUser}\n` +
            `  - 上报发送消息数: ${item.msgCount}`
          ).join('\n');

          return {
            content: [{
              type: 'text',
              text: `消息发送概况数据 (${validated.beginDate} 至 ${validated.endDate}):\n\n${message}`
            }]
          };
        }

        case 'get_interface_summary': {
          if (!validated.beginDate || !validated.endDate) {
            throw new Error('get_interface_summary 操作需要 beginDate 和 endDate 参数');
          }

          const result = await apiClient.getInterfaceSummary(validated.beginDate, validated.endDate);
          const summary = result.list.map(item =>
            `${item.refDate}:\n` +
            `  - 调用次数: ${item.callbackCount}\n` +
            `  - 失败次数: ${item.failCount}\n` +
            `  - 总耗时: ${item.totalTime}ms\n` +
            `  - 最大耗时: ${item.maxTime}ms`
          ).join('\n');

          return {
            content: [{
              type: 'text',
              text: `接口分析数据 (${validated.beginDate} 至 ${validated.endDate}):\n\n${summary}`
            }]
          };
        }

        case 'get_interface_summary_hour': {
          if (!validated.beginDate || !validated.endDate) {
            throw new Error('get_interface_summary_hour 操作需要 beginDate 和 endDate 参数');
          }

          const result = await apiClient.getInterfaceSummaryHour(validated.beginDate, validated.endDate);
          const summary = result.list.slice(0, 24).map(item =>
            `${item.refDate} ${item.refHour}:00:\n` +
            `  - 调用次数: ${item.callbackCount}\n` +
            `  - 失败次数: ${item.failCount}\n` +
            `  - 总耗时: ${item.totalTime}ms\n` +
            `  - 最大耗时: ${item.maxTime}ms`
          ).join('\n');

          return {
            content: [{
              type: 'text',
              text: `接口分析分时数据 (${validated.beginDate} 至 ${validated.endDate}):\n\n${summary}`
            }]
          };
        }

        default:
          throw new Error(`未知的操作: ${validated.action}`);
      }
    } catch (error) {
      logger.error('Statistics tool error:', error);
      throw error;
    }
  }
};

// 参数解析辅助函数
function parseStatisticsParams(params: unknown): any {
  return params as any;
}

import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// 验证 Schema
const openIdSchema = z.string().min(1, 'OpenID不能为空');
const mediaIdSchema = z.string().min(1, 'MediaID不能为空');

export const customerServiceMcpTool: McpTool = {
  name: 'wechat_customer_service',
  description: '微信公众号客服消息 - 发送客服消息（文本、图片、语音、视频等），获取聊天记录',
  inputSchema: {
    action: z.enum([
      'send_text',
      'send_image',
      'send_voice',
      'send_video',
      'send_music',
      'send_news',
      'send_mpnews',
      'get_records'
    ]),
    toUser: openIdSchema.optional(),
    content: z.string().optional(),
    mediaId: mediaIdSchema.optional(),
    thumbMediaId: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    musicUrl: z.string().url().optional(),
    hqMusicUrl: z.string().url().optional(),
    articles: z.array(z.any()).optional(), // 图文消息
    startTime: z.number().int().positive().optional(),
    endTime: z.number().int().positive().optional(),
    msgId: z.number().int().optional(),
    number: z.number().int().positive().optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    try {
      const validated = parseCustomerServiceParams(params);

      switch (validated.action) {
        case 'send_text': {
          if (!validated.toUser) {
            throw new Error('send_text 操作需要 toUser 参数');
          }
          if (!validated.content) {
            throw new Error('send_text 操作需要 content 参数');
          }

          await apiClient.sendCustomMessage({
            touser: validated.toUser,
            msgtype: 'text',
            text: { content: validated.content }
          });

          return {
            content: [{
              type: 'text',
              text: `文本客服消息发送成功\n- 接收者: ${validated.toUser}\n- 内容: ${validated.content}`
            }]
          };
        }

        case 'send_image': {
          if (!validated.toUser) {
            throw new Error('send_image 操作需要 toUser 参数');
          }
          if (!validated.mediaId) {
            throw new Error('send_image 操作需要 mediaId 参数');
          }

          await apiClient.sendCustomMessage({
            touser: validated.toUser,
            msgtype: 'image',
            image: { mediaId: validated.mediaId }
          });

          return {
            content: [{
              type: 'text',
              text: `图片客服消息发送成功\n- 接收者: ${validated.toUser}\n- MediaID: ${validated.mediaId}`
            }]
          };
        }

        case 'send_voice': {
          if (!validated.toUser) {
            throw new Error('send_voice 操作需要 toUser 参数');
          }
          if (!validated.mediaId) {
            throw new Error('send_voice 操作需要 mediaId 参数');
          }

          await apiClient.sendCustomMessage({
            touser: validated.toUser,
            msgtype: 'voice',
            voice: { mediaId: validated.mediaId }
          });

          return {
            content: [{
              type: 'text',
              text: `语音客服消息发送成功\n- 接收者: ${validated.toUser}\n- MediaID: ${validated.mediaId}`
            }]
          };
        }

        case 'send_video': {
          if (!validated.toUser) {
            throw new Error('send_video 操作需要 toUser 参数');
          }
          if (!validated.mediaId) {
            throw new Error('send_video 操作需要 mediaId 参数');
          }
          if (!validated.thumbMediaId) {
            throw new Error('send_video 操作需要 thumbMediaId 参数');
          }

          await apiClient.sendCustomMessage({
            touser: validated.toUser,
            msgtype: 'video',
            video: {
              mediaId: validated.mediaId,
              thumbMediaId: validated.thumbMediaId,
              title: validated.title,
              description: validated.description
            }
          });

          return {
            content: [{
              type: 'text',
              text: `视频客服消息发送成功\n- 接收者: ${validated.toUser}\n- MediaID: ${validated.mediaId}`
            }]
          };
        }

        case 'send_music': {
          if (!validated.toUser) {
            throw new Error('send_music 操作需要 toUser 参数');
          }
          if (!validated.musicUrl) {
            throw new Error('send_music 操作需要 musicUrl 参数');
          }

          await apiClient.sendCustomMessage({
            touser: validated.toUser,
            msgtype: 'music',
            music: {
              title: validated.title || '',
              description: validated.description || '',
              musicurl: validated.musicUrl,
              hqmusicurl: validated.hqMusicUrl || validated.musicUrl,
              thumbMediaId: validated.thumbMediaId
            }
          });

          return {
            content: [{
              type: 'text',
              text: `音乐客服消息发送成功\n- 接收者: ${validated.toUser}\n- 标题: ${validated.title || '无'}`
            }]
          };
        }

        case 'send_news': {
          if (!validated.toUser) {
            throw new Error('send_news 操作需要 toUser 参数');
          }
          if (!validated.articles || validated.articles.length === 0) {
            throw new Error('send_news 操作需要 articles 参数');
          }

          await apiClient.sendCustomMessage({
            touser: validated.toUser,
            msgtype: 'news',
            news: { articles: validated.articles }
          });

          return {
            content: [{
              type: 'text',
              text: `图文客服消息发送成功\n- 接收者: ${validated.toUser}\n- 文章数量: ${validated.articles.length}`
            }]
          };
        }

        case 'send_mpnews': {
          if (!validated.toUser) {
            throw new Error('send_mpnews 操作需要 toUser 参数');
          }
          if (!validated.mediaId) {
            throw new Error('send_mpnews 操作需要 mediaId 参数');
          }

          await apiClient.sendCustomMessage({
            touser: validated.toUser,
            msgtype: 'mpnews',
            mpnews: { mediaId: validated.mediaId }
          });

          return {
            content: [{
              type: 'text',
              text: `图文客服消息发送成功\n- 接收者: ${validated.toUser}\n- MediaID: ${validated.mediaId}`
            }]
          };
        }

        case 'get_records': {
          if (!validated.startTime) {
            throw new Error('get_records 操作需要 startTime 参数（Unix时间戳）');
          }
          if (!validated.endTime) {
            throw new Error('get_records 操作需要 endTime 参数（Unix时间戳）');
          }

          const result = await apiClient.getCustomMessageRecords(
            validated.startTime,
            validated.endTime,
            validated.msgId,
            validated.number
          );

          const records = result.records.map((record, index) =>
            `${index + 1}. ${record.worker} -> ${record.openid}\n` +
            `   时间: ${new Date(record.time * 1000).toLocaleString()}\n` +
            `   内容: ${record.text}\n`
          ).join('\n');

          return {
            content: [{
              type: 'text',
              text: `客服聊天记录 (共 ${result.records.length} 条):\n${records}`
            }]
          };
        }

        default:
          throw new Error(`未知的操作: ${validated.action}`);
      }
    } catch (error) {
      logger.error('Customer service tool error:', error);
      throw error;
    }
  }
};

// 参数解析辅助函数
function parseCustomerServiceParams(params: unknown): any {
  return params as any;
}

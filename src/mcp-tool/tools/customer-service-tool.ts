import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { jsonResult } from '../json-result.js';

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
    articles: z.array(z.record(z.unknown())).optional(),
    startTime: z.number().int().positive().optional(),
    endTime: z.number().int().positive().optional(),
    msgId: z.number().int().optional(),
    number: z.number().int().positive().optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
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

          return jsonResult({
            action: 'send_text',
            toUser: validated.toUser,
            msgType: 'text',
            content: validated.content
          });
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

          return jsonResult({
            action: 'send_image',
            toUser: validated.toUser,
            msgType: 'image',
            mediaId: validated.mediaId
          });
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

          return jsonResult({
            action: 'send_voice',
            toUser: validated.toUser,
            msgType: 'voice',
            mediaId: validated.mediaId
          });
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

          return jsonResult({
            action: 'send_video',
            toUser: validated.toUser,
            msgType: 'video',
            mediaId: validated.mediaId,
            thumbMediaId: validated.thumbMediaId,
            title: validated.title ?? null,
            description: validated.description ?? null
          });
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

          return jsonResult({
            action: 'send_music',
            toUser: validated.toUser,
            msgType: 'music',
            musicUrl: validated.musicUrl,
            hqMusicUrl: validated.hqMusicUrl || validated.musicUrl,
            title: validated.title || null,
            description: validated.description || null,
            thumbMediaId: validated.thumbMediaId ?? null
          });
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

          return jsonResult({
            action: 'send_news',
            toUser: validated.toUser,
            msgType: 'news',
            articleCount: validated.articles.length,
            articles: validated.articles
          });
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

          return jsonResult({
            action: 'send_mpnews',
            toUser: validated.toUser,
            msgType: 'mpnews',
            mediaId: validated.mediaId
          });
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

          return jsonResult({
            action: 'get_records',
            count: result.records.length,
            startTime: validated.startTime,
            endTime: validated.endTime,
            records: result.records.map((record) => ({
              worker: record.worker,
              openId: record.openid,
              operCode: record.opercode,
              time: record.time,
              text: record.text
            }))
          });
        }

      default:
        throw new Error(`未知的操作: ${validated.action}`);
    }
  }
};

// 参数解析辅助函数
function parseCustomerServiceParams(params: unknown) {
  return z.object({
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
    toUser: z.string().min(1, 'OpenID不能为空').optional(),
    content: z.string().optional(),
    mediaId: z.string().min(1, 'MediaID不能为空').optional(),
    thumbMediaId: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    musicUrl: z.string().url().optional(),
    hqMusicUrl: z.string().url().optional(),
    articles: z.array(z.record(z.unknown())).optional(),
    startTime: z.number().int().positive().optional(),
    endTime: z.number().int().positive().optional(),
    msgId: z.number().int().optional(),
    number: z.number().int().positive().optional(),
  }).parse(params);
}

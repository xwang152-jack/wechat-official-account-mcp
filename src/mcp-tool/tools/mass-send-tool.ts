import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';

// 验证 Schema
const mediaIdSchema = z.string().min(1, 'MediaID不能为空');
const tagIdSchema = z.number().int().positive('标签ID必须为正整数');

// 群发消息数据类型 - 按标签群发
interface MassMessageByTagData {
  filter: { isToAll: boolean; tagId?: number };
  msgtype: 'mpnews' | 'text' | 'voice' | 'image' | 'mpvideo' | 'wxcard';
  mpnews?: { mediaId: string };
  text?: { content: string };
  voice?: { mediaId: string };
  image?: { mediaId: string };
  mpvideo?: { mediaId: string };
  wxcard?: { cardId: string };
  sendIgnoreReprint?: number;
  [key: string]: unknown;
}

// 群发消息数据类型 - 按OpenID群发
interface MassMessageByOpenIdData {
  touser: string[];
  msgtype: 'mpnews' | 'text' | 'voice' | 'image' | 'mpvideo' | 'wxcard';
  mpnews?: { mediaId: string };
  text?: { content: string };
  voice?: { mediaId: string };
  image?: { mediaId: string };
  mpvideo?: { mediaId: string };
  wxcard?: { cardId: string };
  sendIgnoreReprint?: number;
  [key: string]: unknown;
}

export const massSendMcpTool: McpTool = {
  name: 'wechat_mass_send',
  description: '微信公众号群发消息 - 根据标签或OpenID列表群发图文、文本、图片等消息，支持删除和预览',
  inputSchema: {
    action: z.enum([
      'send_by_tag',
      'send_by_openid',
      'delete',
      'preview'
    ]),
    // 根据标签群发参数
    isToAll: z.boolean().optional(),
    tagId: tagIdSchema.optional(),
    // 根据OpenID群发参数
    toUser: z.array(z.string().min(1, 'OpenID不能为空')).optional(),
    // 通用消息参数
    msgtype: z.enum(['mpnews', 'text', 'voice', 'image', 'mpvideo', 'wxcard']).optional(),
    mediaId: mediaIdSchema.optional(),
    content: z.string().optional(),
    sendIgnoreReprint: z.number().int().min(0).max(1).optional(),
    // 删除参数
    msgId: z.number().int().positive().optional(),
    articleIdx: z.number().int().min(0).optional(),
    // 预览参数
    previewToUser: z.string().optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    const validated = parseMassSendParams(params);

    switch (validated.action) {
      case 'send_by_tag': {
        if (validated.isToAll === undefined && !validated.tagId) {
          throw new Error('send_by_tag 操作需要 isToAll 或 tagId 参数');
        }
        if (!validated.msgtype) {
          throw new Error('send_by_tag 操作需要 msgtype 参数');
        }

        const data: MassMessageByTagData = {
          filter: {
            isToAll: validated.isToAll || false,
            ...(validated.tagId !== undefined && { tagId: validated.tagId })
          },
          msgtype: validated.msgtype
        };

        // 根据消息类型添加内容
        if (validated.msgtype === 'mpnews' || validated.msgtype === 'mpvideo') {
          if (!validated.mediaId) {
            throw new Error(`${validated.msgtype} 类型需要 mediaId 参数`);
          }
          data[validated.msgtype] = { mediaId: validated.mediaId };
        } else if (validated.msgtype === 'text') {
          if (!validated.content) {
            throw new Error('text 类型需要 content 参数');
          }
          data.text = { content: validated.content };
        } else if (validated.msgtype === 'voice' || validated.msgtype === 'image') {
          if (!validated.mediaId) {
            throw new Error(`${validated.msgtype} 类型需要 mediaId 参数`);
          }
          data[validated.msgtype] = { mediaId: validated.mediaId };
        } else if (validated.msgtype === 'wxcard') {
          if (!validated.mediaId) {
            throw new Error('wxcard 类型需要 cardId 参数');
          }
          data.wxcard = { cardId: validated.mediaId };
        }

        if (validated.sendIgnoreReprint !== undefined) {
          data.sendIgnoreReprint = validated.sendIgnoreReprint;
        }

        const result = await apiClient.sendMassMessageByTag(data);

        return {
          content: [{
            type: 'text',
            text: `群发消息提交成功\n` +
                  `- 消息ID: ${result.msgId}\n` +
                  `- 数据ID: ${result.msgDataId}\n` +
                  `- 发送方式: ${validated.isToAll ? '全部用户' : `标签 ${validated.tagId}`}\n` +
                  `- 消息类型: ${validated.msgtype}`
          }]
        };
      }

        case 'send_by_openid': {
          if (!validated.toUser || validated.toUser.length === 0) {
            throw new Error('send_by_openid 操作需要 toUser 参数（OpenID数组）');
          }
          if (validated.toUser.length > 10000) {
            throw new Error('OpenID列表长度不能超过10000');
          }
          if (!validated.msgtype) {
            throw new Error('send_by_openid 操作需要 msgtype 参数');
          }

          const data: MassMessageByOpenIdData = {
            touser: validated.toUser,
            msgtype: validated.msgtype
          };

          // 根据消息类型添加内容（同上）
          if (validated.msgtype === 'mpnews' || validated.msgtype === 'mpvideo') {
            if (!validated.mediaId) {
              throw new Error(`${validated.msgtype} 类型需要 mediaId 参数`);
            }
            data[validated.msgtype] = { mediaId: validated.mediaId };
          } else if (validated.msgtype === 'text') {
            if (!validated.content) {
              throw new Error('text 类型需要 content 参数');
            }
            data.text = { content: validated.content };
          } else if (validated.msgtype === 'voice' || validated.msgtype === 'image') {
            if (!validated.mediaId) {
              throw new Error(`${validated.msgtype} 类型需要 mediaId 参数`);
            }
            data[validated.msgtype] = { mediaId: validated.mediaId };
          } else if (validated.msgtype === 'wxcard') {
            if (!validated.mediaId) {
              throw new Error('wxcard 类型需要 cardId 参数');
            }
            data.wxcard = { cardId: validated.mediaId };
          }

          if (validated.sendIgnoreReprint !== undefined) {
            data.sendIgnoreReprint = validated.sendIgnoreReprint;
          }

          const result = await apiClient.sendMassMessageByOpenId(data);

          return {
            content: [{
              type: 'text',
              text: `群发消息提交成功\n` +
                    `- 消息ID: ${result.msgId}\n` +
                    `- 数据ID: ${result.msgDataId}\n` +
                    `- 发送人数: ${validated.toUser.length}\n` +
                    `- 消息类型: ${validated.msgtype}`
            }]
          };
        }

        case 'delete': {
          if (!validated.msgId) {
            throw new Error('delete 操作需要 msgId 参数');
          }

          await apiClient.deleteMassMessage(validated.msgId, validated.articleIdx);

          return {
            content: [{
              type: 'text',
              text: `群发消息删除成功\n` +
                    `- 消息ID: ${validated.msgId}\n` +
                    `${validated.articleIdx !== undefined ? `- 文章索引: ${validated.articleIdx}` : ''}`
            }]
          };
        }

        case 'preview': {
          if (!validated.previewToUser) {
            throw new Error('preview 操作需要 previewToUser 参数（接收者OpenID）');
          }
          if (!validated.msgtype) {
            throw new Error('preview 操作需要 msgtype 参数');
          }

          const data = {
            touser: validated.previewToUser,
            msgtype: validated.msgtype as 'mpnews' | 'text' | 'voice' | 'image' | 'mpvideo' | 'wxcard',
            mpnews: undefined as { mediaId: string } | undefined,
            text: undefined as { content: string } | undefined,
            voice: undefined as { mediaId: string } | undefined,
            image: undefined as { mediaId: string } | undefined,
            mpvideo: undefined as { mediaId: string } | undefined,
            wxcard: undefined as { cardId: string } | undefined,
          };

          // 根据消息类型添加内容（同上）
          if (validated.msgtype === 'mpnews' || validated.msgtype === 'mpvideo') {
            if (!validated.mediaId) {
              throw new Error(`${validated.msgtype} 类型需要 mediaId 参数`);
            }
            data[validated.msgtype] = { mediaId: validated.mediaId };
          } else if (validated.msgtype === 'text') {
            if (!validated.content) {
              throw new Error('text 类型需要 content 参数');
            }
            data.text = { content: validated.content };
          } else if (validated.msgtype === 'voice' || validated.msgtype === 'image') {
            if (!validated.mediaId) {
              throw new Error(`${validated.msgtype} 类型需要 mediaId 参数`);
            }
            data[validated.msgtype] = { mediaId: validated.mediaId };
          } else if (validated.msgtype === 'wxcard') {
            if (!validated.mediaId) {
              throw new Error('wxcard 类型需要 cardId 参数');
            }
            data.wxcard = { cardId: validated.mediaId };
          }

          const result = await apiClient.previewMassMessage(data);

          return {
            content: [{
              type: 'text',
              text: `预览消息发送成功\n` +
                    `- 消息ID: ${result.msgId}\n` +
                    `- 接收者: ${validated.previewToUser}\n` +
                    `- 消息类型: ${validated.msgtype}`
            }]
          };
        }

      default:
        throw new Error(`未知的操作: ${validated.action}`);
    }
  }
};

// 参数解析辅助函数
function parseMassSendParams(params: unknown) {
  return z.object({
    action: z.enum([
      'send_by_tag',
      'send_by_openid',
      'delete',
      'preview'
    ]),
    isToAll: z.boolean().optional(),
    tagId: z.number().int().positive('标签ID必须为正整数').optional(),
    toUser: z.array(z.string().min(1, 'OpenID不能为空')).optional(),
    msgtype: z.enum(['mpnews', 'text', 'voice', 'image', 'mpvideo', 'wxcard']).optional(),
    mediaId: z.string().min(1, 'MediaID不能为空').optional(),
    content: z.string().optional(),
    sendIgnoreReprint: z.number().int().min(0).max(1).optional(),
    msgId: z.number().int().positive().optional(),
    articleIdx: z.number().int().min(0).optional(),
    previewToUser: z.string().optional(),
  }).parse(params);
}

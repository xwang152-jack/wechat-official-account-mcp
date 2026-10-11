import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { jsonResult } from '../json-result.js';

// 验证 Schema
const templateIdSchema = z.string().min(1, '模板ID不能为空');
const openIdSchema = z.string().min(1, 'OpenID不能为空');

// 订阅消息发送数据接口
interface SubscribeMessageData {
  touser: string;
  templateId: string;
  data: Record<string, { value?: string }>;
  page?: string;
  miniprogram?: {
    appId: string;
    pagePath: string;
  };
}

export const subscribeMsgMcpTool: McpTool = {
  name: 'wechat_subscribe_msg',
  description: '微信公众号订阅通知 - 发送一次性订阅通知给用户',
  inputSchema: {
    action: z.enum([
      'send'
    ]),
    toUser: openIdSchema,
    templateId: templateIdSchema,
    page: z.string().optional(),
    miniProgramAppId: z.string().optional(),
    miniProgramPagePath: z.string().optional(),
    data: z.record(z.object({
      value: z.string()
    })),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    const validated = parseSubscribeMsgParams(params);

    switch (validated.action) {
      case 'send': {
        if (!validated.data || Object.keys(validated.data).length === 0) {
          throw new Error('send 操作需要 data 参数（模板数据）');
        }

        const data: SubscribeMessageData = {
          touser: validated.toUser,
          templateId: validated.templateId,
          data: validated.data
        };

        // 添加页面参数
        if (validated.page) {
          data.page = validated.page;
        }

        // 添加小程序参数
        if (validated.miniProgramAppId && validated.miniProgramPagePath) {
          data.miniprogram = {
            appId: validated.miniProgramAppId,
            pagePath: validated.miniProgramPagePath
          };
        }

        const result = await apiClient.sendSubscribeMessage({
          ...data,
          data: data.data as Record<string, { value: string }>,
        });

        return jsonResult({
          action: 'send',
          msgId: result.msgid ?? null,
          toUser: validated.toUser,
          templateId: validated.templateId,
          page: validated.page ?? null,
          miniProgramAppId: validated.miniProgramAppId ?? null,
          miniProgramPagePath: validated.miniProgramPagePath ?? null
        });
      }

      default:
        throw new Error(`未知的操作: ${validated.action}`);
    }
  }
};

// 参数解析辅助函数
function parseSubscribeMsgParams(params: unknown) {
  return z.object({
    action: z.enum([
      'send'
    ]),
    toUser: z.string().min(1, 'OpenID不能为空'),
    templateId: z.string().min(1, '模板ID不能为空'),
    page: z.string().optional(),
    miniProgramAppId: z.string().optional(),
    miniProgramPagePath: z.string().optional(),
    data: z.record(z.object({
      value: z.string()
    })),
  }).parse(params);
}

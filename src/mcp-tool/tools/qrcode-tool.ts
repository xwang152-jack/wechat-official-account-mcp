import { z } from 'zod';
import { McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';
import { jsonResult } from '../json-result.js';

const qrcodeToolSchema = z.object({
  action: z.enum(['create_temp', 'create_permanent', 'get_url']),
  sceneId: z.number().optional().describe('场景值ID（临时二维码:32位非0整数, 永久二维码:1-100000'),
  sceneStr: z.string().optional().describe('场景值字符串（仅永久二维码支持）'),
  expireSeconds: z.number().optional().describe('临时二维码有效期（秒），最大30天（2592000）'),
  ticket: z.string().optional().describe('二维码ticket，用于换取二维码图片URL'),
});

export const qrcodeMcpTool: McpTool = {
  name: 'wechat_qrcode',
  description: '微信公众号二维码管理工具。创建临时/永久二维码，获取二维码图片URL。适用于渠道追踪、线下推广等场景。',
  inputSchema: {
    action: z.enum(['create_temp', 'create_permanent', 'get_url']),
    sceneId: z.number().optional().describe('场景值ID（临时二维码:32位非0整数, 永久二维码:1-100000）'),
    sceneStr: z.string().optional().describe('场景值字符串（仅永久二维码支持）'),
    expireSeconds: z.number().optional().describe('临时二维码有效期（秒），最大30天'),
    ticket: z.string().optional().describe('二维码ticket，用于换取二维码图片URL'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const args = qrcodeToolSchema.parse(params);

    if (args.action === 'create_temp') {
      if (!args.sceneId && !args.sceneStr) {
        throw new Error('创建临时二维码需要提供 sceneId 或 sceneStr');
      }
      const actionName = args.sceneStr ? 'QR_STR_SCENE' as const : 'QR_SCENE' as const;
      const result = await apiClient.createQrCode({
        expireSeconds: args.expireSeconds || 604800,
        actionName,
        sceneId: args.sceneId,
        sceneStr: args.sceneStr,
      });
      const imageUrl = apiClient.getQrCodeUrl(result.ticket);
      return jsonResult({
        action: 'create_temp',
        ticket: result.ticket,
        expireSeconds: result.expireSeconds ?? null,
        url: result.url ?? null,
        imageUrl,
        sceneId: args.sceneId ?? null,
        sceneStr: args.sceneStr ?? null,
      });
    }

    if (args.action === 'create_permanent') {
      if (!args.sceneId && !args.sceneStr) {
        throw new Error('创建永久二维码需要提供 sceneId 或 sceneStr');
      }
      const actionName = args.sceneStr ? 'QR_LIMIT_STR_SCENE' as const : 'QR_LIMIT_SCENE' as const;
      const result = await apiClient.createQrCode({
        actionName,
        sceneId: args.sceneId,
        sceneStr: args.sceneStr,
      });
      const imageUrl = apiClient.getQrCodeUrl(result.ticket);
      return jsonResult({
        action: 'create_permanent',
        ticket: result.ticket,
        url: result.url ?? null,
        imageUrl,
        sceneId: args.sceneId ?? null,
        sceneStr: args.sceneStr ?? null,
      });
    }

    if (args.action === 'get_url') {
      if (!args.ticket) {
        throw new Error('获取二维码图片需要提供 ticket 参数');
      }
      const imageUrl = apiClient.getQrCodeUrl(args.ticket);
      return jsonResult({
        action: 'get_url',
        ticket: args.ticket,
        imageUrl,
      });
    }

    throw new Error(`不支持的操作: ${args.action}`);
  },
};

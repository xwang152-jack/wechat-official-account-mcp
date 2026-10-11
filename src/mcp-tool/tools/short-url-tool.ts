import { z } from 'zod';
import { McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';
import { jsonResult } from '../json-result.js';

const shortUrlToolSchema = z.object({
  action: z.enum(['generate', 'fetch']),
  longData: z.string().min(1, '长信息不能为空').optional().describe('需要转换的长信息（不超过 4KB），generate 时必需'),
  shortKey: z.string().min(1, '短key不能为空').optional().describe('短 key（15 字节 base62），fetch 时必需'),
  expireSeconds: z.number().int().positive().max(2592000, '有效期最长 30 天（2592000 秒）').optional()
    .describe('过期秒数，最大 2592000（30 天），默认 30 天'),
});

export const shortUrlMcpTool: McpTool = {
  name: 'wechat_short_url',
  description:
    '微信公众号长信息与短 key 互转（/cgi-bin/shorten/gen 与 /cgi-bin/shorten/fetch）。' +
    '注意：返回的是 15 字节 base62 短 key，不是可直接点击的短链接，需用 fetch 还原；' +
    '长信息不超过 4KB，有效期最长 30 天。仅认证服务号/小程序可调用。',
  inputSchema: {
    action: z.enum(['generate', 'fetch']).describe('generate(长信息转短key), fetch(短key还原长信息)'),
    longData: z.string().optional().describe('需要转换的长信息（不超过 4KB），generate 时必需'),
    shortKey: z.string().optional().describe('短 key，fetch 时必需'),
    expireSeconds: z.number().optional().describe('过期秒数，最大 2592000（30 天），默认 30 天'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const args = shortUrlToolSchema.parse(params);

    if (args.action === 'generate') {
      if (!args.longData) {
        throw new Error('generate 操作需要 longData 参数');
      }

      const result = await apiClient.genShortKey(args.longData, args.expireSeconds);

      return jsonResult({
        action: 'generate',
        shortKey: result.short_key,
        longDataLength: args.longData.length,
        expireSeconds: args.expireSeconds ?? 2592000,
        note: '短 key 不是短链接，需通过本工具的 fetch 操作还原为长信息。',
      });
    }

    if (!args.shortKey) {
      throw new Error('fetch 操作需要 shortKey 参数');
    }

    const result = await apiClient.fetchShorten(args.shortKey);

    return jsonResult({
      action: 'fetch',
      shortKey: args.shortKey,
      longData: result.long_data,
    });
  },
};

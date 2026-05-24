import { z } from 'zod';
import { McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';

const shortUrlToolSchema = z.object({
  action: z.literal('generate'),
  longUrl: z.string().describe('需要转换的长链接URL'),
});

export const shortUrlMcpTool: McpTool = {
  name: 'wechat_short_url',
  description: '微信公众号长链接转短链接工具。将长URL转换为短链接，适用于二维码、短信等场景。',
  inputSchema: {
    action: z.literal('generate'),
    longUrl: z.string().describe('需要转换的长链接URL'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const args = shortUrlToolSchema.parse(params);

    const result = await apiClient.shortUrl(args.longUrl);

    return {
      content: [{
        type: 'text' as const,
        text: `短链接生成成功\n\n原始链接: ${args.longUrl}\n短链接: ${result.shortUrl}`,
      }],
    };
  },
};

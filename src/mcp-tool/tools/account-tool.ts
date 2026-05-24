import { z } from 'zod';
import { McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';

const accountToolSchema = z.object({
  action: z.enum(['clear_quota', 'get_quota']),
  cgiPath: z.string().optional().describe('查询配额的API路径（如 /cgi-bin/message/custom/send）'),
});

export const accountMcpTool: McpTool = {
  name: 'wechat_account',
  description: '微信公众号账号管理工具。查询API调用次数配额、重置API调用次数。用于监控和管理公众号接口调用频率。',
  inputSchema: {
    action: z.enum(['clear_quota', 'get_quota']),
    cgiPath: z.string().optional().describe('查询配额的API路径'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const args = accountToolSchema.parse(params);

    switch (args.action) {
      case 'clear_quota': {
        await apiClient.clearQuota();
        return {
          content: [{
            type: 'text' as const,
            text: 'API调用次数已重置成功',
          }],
        };
      }
      case 'get_quota': {
        if (!args.cgiPath) {
          throw new Error('查询配额需要提供 cgiPath 参数（如 /cgi-bin/message/custom/send）');
        }
        const result = await apiClient.getApiQuota(args.cgiPath);
        return {
          content: [{
            type: 'text' as const,
            text: `API调用次数配额 (${args.cgiPath})\n\n每日限额: ${result.quota.daily_limit}\n已使用: ${result.quota.used}\n剩余: ${result.quota.remain}`,
          }],
        };
      }
      default:
        throw new Error(`不支持的操作: ${args.action}`);
    }
  },
};

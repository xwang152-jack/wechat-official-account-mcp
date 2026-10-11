import { z } from 'zod';
import { McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';
import { jsonResult } from '../json-result.js';

const blacklistToolSchema = z.object({
  action: z.enum(['get_list', 'block', 'unblock']),
  openIdList: z.array(z.string()).optional().describe('用户OpenID列表（block/unblock时必填，最多20个）'),
  beginOpenId: z.string().optional().describe('分页起始OpenID，第一次请求不填'),
});

export const blacklistMcpTool: McpTool = {
  name: 'wechat_blacklist',
  description: '微信公众号黑名单管理工具。查看黑名单列表、拉黑/取消拉黑用户。被拉黑的用户无法收到公众号消息。',
  inputSchema: {
    action: z.enum(['get_list', 'block', 'unblock']),
    openIdList: z.array(z.string()).optional().describe('用户OpenID列表（block/unblock时必填，最多20个）'),
    beginOpenId: z.string().optional().describe('分页起始OpenID'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const args = blacklistToolSchema.parse(params);

    switch (args.action) {
      case 'get_list': {
        const result = await apiClient.getBlackList(args.beginOpenId);
        return jsonResult({
          action: 'get_list',
          total: result.total,
          count: result.count,
          openids: result.data?.openid ?? [],
          nextOpenid: result.next_openid || null,
        });
      }
      case 'block': {
        if (!args.openIdList || args.openIdList.length === 0) {
          throw new Error('拉黑用户需要提供 openIdList');
        }
        await apiClient.batchBlackList(args.openIdList);
        return jsonResult({
          action: 'block',
          blocked: args.openIdList.length,
          openids: args.openIdList,
        });
      }
      case 'unblock': {
        if (!args.openIdList || args.openIdList.length === 0) {
          throw new Error('取消拉黑需要提供 openIdList');
        }
        await apiClient.batchUnBlackList(args.openIdList);
        return jsonResult({
          action: 'unblock',
          unblocked: args.openIdList.length,
          openids: args.openIdList,
        });
      }
      default:
        throw new Error(`不支持的操作: ${args.action}`);
    }
  },
};

import { z } from 'zod';
import { McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';

const kfAccountToolSchema = z.object({
  action: z.enum(['add', 'update', 'delete', 'get_list']),
  kfAccount: z.string().optional().describe('客服账号（格式：账号@公众号昵称）'),
  nickname: z.string().optional().describe('客服昵称'),
  password: z.string().optional().describe('客服密码'),
});

export const kfAccountMcpTool: McpTool = {
  name: 'wechat_kf_account',
  description: '微信公众号客服账号管理工具。添加、修改、删除客服账号，获取客服列表。客服账号用于管理多客服人员。',
  inputSchema: {
    action: z.enum(['add', 'update', 'delete', 'get_list']),
    kfAccount: z.string().optional().describe('客服账号（格式：账号@公众号昵称）'),
    nickname: z.string().optional().describe('客服昵称'),
    password: z.string().optional().describe('客服密码'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const args = kfAccountToolSchema.parse(params);

    switch (args.action) {
      case 'add': {
        if (!args.kfAccount || !args.nickname) {
          throw new Error('添加客服需要提供 kfAccount 和 nickname');
        }
        await apiClient.addKfAccount(args.kfAccount, args.nickname, args.password || '');
        return {
          content: [{
            type: 'text' as const,
            text: `客服账号添加成功: ${args.kfAccount} (${args.nickname})`,
          }],
        };
      }
      case 'update': {
        if (!args.kfAccount || !args.nickname) {
          throw new Error('修改客服需要提供 kfAccount 和 nickname');
        }
        await apiClient.updateKfAccount(args.kfAccount, args.nickname, args.password || '');
        return {
          content: [{
            type: 'text' as const,
            text: `客服账号修改成功: ${args.kfAccount}`,
          }],
        };
      }
      case 'delete': {
        if (!args.kfAccount) {
          throw new Error('删除客服需要提供 kfAccount');
        }
        await apiClient.deleteKfAccount(args.kfAccount);
        return {
          content: [{
            type: 'text' as const,
            text: `客服账号已删除: ${args.kfAccount}`,
          }],
        };
      }
      case 'get_list': {
        const result = await apiClient.getKfList();
        const list = result.kf_list.map(kf =>
          `- ${kf.kf_account} (${kf.kf_nick}, ID: ${kf.kf_id})`
        ).join('\n');
        return {
          content: [{
            type: 'text' as const,
            text: `客服账号列表 (共${result.kf_list.length}个)\n\n${list || '暂无客服账号'}`,
          }],
        };
      }
      default:
        throw new Error(`不支持的操作: ${args.action}`);
    }
  },
};

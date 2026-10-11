import { z } from 'zod';
import { McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';
import { jsonResult } from '../json-result.js';

const accountToolSchema = z.object({
  action: z.enum([
    'clear_quota',
    'get_quota',
    'clear_api_quota',
    'get_rid_info',
    'get_api_domain_ip',
    'change_openid',
  ]),
  cgiPath: z.string().optional().describe('API 路径（如 /cgi-bin/message/custom/send）'),
  rid: z.string().optional().describe('接口报错返回的 rid'),
  fromAppId: z.string().optional().describe('转换 openid 时的原 AppID'),
  openIdList: z.array(z.string()).optional().describe('需要转换的 openid 列表'),
});

export const accountMcpTool: McpTool = {
  name: 'wechat_account',
  description:
    '微信公众号账号与接口管理工具。查询/重置 API 调用配额、用 rid 定位接口报错、获取微信 API 服务器 IP、转换 openid。' +
    '用于监控调用频率与排查接口故障。',
  inputSchema: {
    action: z.enum([
      'clear_quota',
      'get_quota',
      'clear_api_quota',
      'get_rid_info',
      'get_api_domain_ip',
      'change_openid',
    ]).describe(
      '操作类型：clear_quota(重置全部接口调用次数), get_quota(查询指定接口配额), ' +
      'clear_api_quota(重置指定接口调用次数), get_rid_info(用rid查询报错详情), ' +
      'get_api_domain_ip(获取微信API服务器IP), change_openid(转换openid)'
    ),
    cgiPath: z.string().optional().describe('API 路径（get_quota、clear_api_quota 时必需）'),
    rid: z.string().optional().describe('接口报错返回的 rid（get_rid_info 时必需）'),
    fromAppId: z.string().optional().describe('原 AppID（change_openid 时必需）'),
    openIdList: z.array(z.string()).optional().describe('需要转换的 openid 列表（change_openid 时必需）'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const args = accountToolSchema.parse(params);

    switch (args.action) {
      case 'clear_quota': {
        await apiClient.clearQuota();
        return jsonResult({
          action: 'clear_quota',
          cleared: true,
        });
      }

      case 'get_quota': {
        if (!args.cgiPath) {
          throw new Error('查询配额需要提供 cgiPath 参数（如 /cgi-bin/message/custom/send）');
        }
        const result = await apiClient.getApiQuota(args.cgiPath);
        return jsonResult({
          action: 'get_quota',
          cgiPath: args.cgiPath,
          dailyLimit: result.quota?.daily_limit ?? null,
          used: result.quota?.used ?? null,
          remain: result.quota?.remain ?? null,
        });
      }

      case 'clear_api_quota': {
        if (!args.cgiPath) {
          throw new Error('重置指定接口配额需要提供 cgiPath 参数（如 /cgi-bin/message/custom/send）');
        }
        await apiClient.clearApiQuota(args.cgiPath);
        return jsonResult({
          action: 'clear_api_quota',
          cgiPath: args.cgiPath,
          cleared: true,
        });
      }

      case 'get_rid_info': {
        if (!args.rid) {
          throw new Error('查询 rid 详情需要提供 rid 参数');
        }
        const result = await apiClient.getRidInfo(args.rid);
        const request = result.request || {} as any;
        return jsonResult({
          action: 'get_rid_info',
          rid: args.rid,
          invokeTime: request.invoke_time
            ? new Date(request.invoke_time * 1000).toISOString()
            : null,
          costInMs: request.cost_in_ms ?? null,
          requestUrl: request.request_url || null,
          requestBody: request.request_body || null,
          responseBody: request.response_body || null,
        });
      }

      case 'get_api_domain_ip': {
        const result = await apiClient.getApiDomainIp();
        const ipList = result.ip_list || [];
        return jsonResult({
          action: 'get_api_domain_ip',
          count: ipList.length,
          ipList,
        });
      }

      case 'change_openid': {
        if (!args.fromAppId) {
          throw new Error('转换 openid 需要提供 fromAppId 参数');
        }
        if (!args.openIdList?.length) {
          throw new Error('转换 openid 需要提供非空的 openIdList 参数');
        }
        const result = await apiClient.changeOpenId(args.fromAppId, args.openIdList);
        const items = (result.result_list || []).map(item => ({
          oriOpenid: item.ori_openid,
          newOpenid: item.new_openid || null,
          error: item.errmsg || null,
        }));
        return jsonResult({
          action: 'change_openid',
          fromAppId: args.fromAppId,
          count: args.openIdList.length,
          total: args.openIdList.length,
          items,
        });
      }

      default:
        throw new Error(`不支持的操作: ${args.action}`);
    }
  },
};

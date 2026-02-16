import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// 验证 Schema
const openIdSchema = z.string().min(1, 'OpenID不能为空');
const remarkSchema = z.string().max(50, '备注名不能超过50个字符').optional();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确，应为YYYY-MM-DD');
const langSchema = z.enum(['zh_CN', 'zh_TW', 'en']);

export const userMcpTool: McpTool = {
  name: 'wechat_user',
  description: '微信公众号用户管理 - 获取用户列表、用户信息、设置备注名、查看用户增减数据等',
  inputSchema: {
    action: z.enum([
      'get_user_list',
      'get_user_info',
      'batch_get_user_info',
      'set_remark',
      'get_user_summary',
      'get_user_cumulate'
    ]),
    nextOpenId: z.string().optional(),
    openId: openIdSchema.optional(),
    openIdList: z.array(openIdSchema).optional(),
    remark: remarkSchema,
    lang: langSchema.optional(),
    beginDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    try {
      const validated = parseUserParams(params);

      switch (validated.action) {
        case 'get_user_list': {
          const result = await apiClient.getUserList(validated.nextOpenId);
          return {
            content: [{
              type: 'text',
              text: `用户列表获取成功:\n` +
                    `- 总用户数: ${result.total}\n` +
                    `- 本次返回: ${result.count} 条\n` +
                    `- 用户OpenIDs: ${result.data.openid.join(', ')}\n` +
                    `${result.nextOpenid ? `- 下一页起始ID: ${result.nextOpenid}` : ''}`
            }]
          };
        }

        case 'get_user_info': {
          if (!validated.openId) {
            throw new Error('get_user_info 需要 openId 参数');
          }

          const user = await apiClient.getUserInfo(validated.openId, validated.lang);
          return {
            content: [{
              type: 'text',
              text: `用户信息:\n` +
                    `- 昵称: ${user.nickname}\n` +
                    `- OpenID: ${user.openid}\n` +
                    `- 是否关注: ${user.subscribe === 1 ? '是' : '否'}\n` +
                    `- 性别: ${user.sex === 1 ? '男' : user.sex === 2 ? '女' : '未知'}\n` +
                    `- 城市: ${user.city} ${user.province} ${user.country}\n` +
                    `- 语言: ${user.language}\n` +
                    `- 头像: ${user.headImgUrl}\n` +
                    `- 关注时间: ${new Date(user.subscribeTime * 1000).toLocaleString()}\n` +
                    `${user.remark ? `- 备注: ${user.remark}` : ''}\n` +
                    `${user.unionId ? `- UnionID: ${user.unionId}` : ''}`
            }]
          };
        }

        case 'batch_get_user_info': {
          if (!validated.openIdList || validated.openIdList.length === 0) {
            throw new Error('batch_get_user_info 需要 openIdList 参数');
          }

          if (validated.openIdList.length > 100) {
            throw new Error('批量获取用户信息最多支持100个用户');
          }

          const result = await apiClient.batchGetUserInfo(validated.openIdList, validated.lang);
          const userList = result.user_info_list.map(user =>
            `- ${user.nickname} (${user.openid}) - ${user.subscribe === 1 ? '已关注' : '未关注'}`
          ).join('\n');

          return {
            content: [{
              type: 'text',
              text: `批量获取用户信息成功，共 ${result.user_info_list.length} 个用户:\n${userList}`
            }]
          };
        }

        case 'set_remark': {
          if (!validated.openId) {
            throw new Error('set_remark 需要 openId 参数');
          }
          if (validated.remark === undefined) {
            throw new Error('set_remark 需要 remark 参数');
          }

          await apiClient.updateUserRemark(validated.openId, validated.remark);
          return {
            content: [{
              type: 'text',
              text: `用户备注设置成功\n- OpenID: ${validated.openId}\n- 备注: ${validated.remark}`
            }]
          };
        }

        case 'get_user_summary': {
          if (!validated.beginDate || !validated.endDate) {
            throw new Error('get_user_summary 需要 beginDate 和 endDate 参数');
          }

          const result = await apiClient.getUserSummary(validated.beginDate, validated.endDate);
          const summary = result.list.map(item =>
            `${item.ref_date}: 新增 ${item.new_user} 人，取消 ${item.cancel_user} 人`
          ).join('\n');

          return {
            content: [{
              type: 'text',
              text: `用户增减数据 (${validated.beginDate} 至 ${validated.endDate}):\n${summary}`
            }]
          };
        }

        case 'get_user_cumulate': {
          if (!validated.beginDate || !validated.endDate) {
            throw new Error('get_user_cumulate 需要 beginDate 和 endDate 参数');
          }

          const result = await apiClient.getUserCumulate(validated.beginDate, validated.endDate);
          const cumulate = result.list.map(item =>
            `${item.ref_date}: 累计用户 ${item.cumulate_user} 人`
          ).join('\n');

          return {
            content: [{
              type: 'text',
              text: `累计用户数据 (${validated.beginDate} 至 ${validated.endDate}):\n${cumulate}`
            }]
          };
        }

        default:
          throw new Error(`未知的操作: ${validated.action}`);
      }
    } catch (error) {
      logger.error('User tool error:', error);
      throw error;
    }
  }
};

// 参数解析辅助函数
function parseUserParams(params: unknown): any {
  return params as any;
}

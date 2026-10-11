import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { jsonResult } from '../json-result.js';

// 验证 Schema
const openIdSchema = z.string().min(1, 'OpenID不能为空');
const remarkSchema = z.string().max(50, '备注名不能超过50个字符').optional();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确，应为YYYY-MM-DD');
const langSchema = z.enum(['zh_CN', 'zh_TW', 'en']);

// 用户工具参数 Schema
const userToolSchema = z.object({
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
});

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
    const validated = userToolSchema.parse(params);

    switch (validated.action) {
      case 'get_user_list': {
        const result = await apiClient.getUserList(validated.nextOpenId);
        return jsonResult({
          action: 'get_user_list',
          total: result.total,
          count: result.count,
          openids: result.data?.openid ?? [],
          nextOpenid: result.nextOpenid || null,
        });
      }

      case 'get_user_info': {
        if (!validated.openId) {
          throw new Error('get_user_info 需要 openId 参数');
        }

        const user = await apiClient.getUserInfo(validated.openId, validated.lang);
        return jsonResult({
          action: 'get_user_info',
          openid: user.openid,
          nickname: user.nickname,
          subscribe: user.subscribe,
          subscribed: user.subscribe === 1,
          sex: user.sex,
          language: user.language ?? null,
          city: user.city ?? null,
          province: user.province ?? null,
          country: user.country ?? null,
          headImgUrl: user.headImgUrl ?? null,
          subscribeTime: user.subscribeTime ?? null,
          unionId: user.unionId ?? null,
          remark: user.remark ?? null,
        });
      }

      case 'batch_get_user_info': {
        if (!validated.openIdList || validated.openIdList.length === 0) {
          throw new Error('batch_get_user_info 需要 openIdList 参数');
        }

        if (validated.openIdList.length > 100) {
          throw new Error('批量获取用户信息最多支持100个用户');
        }

        const result = await apiClient.batchGetUserInfo(validated.openIdList, validated.lang);
        const users = result.user_info_list.map(user => ({
          openid: user.openid,
          nickname: user.nickname,
          subscribe: user.subscribe,
          subscribed: user.subscribe === 1,
          sex: user.sex,
          language: user.language ?? null,
          city: user.city ?? null,
          province: user.province ?? null,
          country: user.country ?? null,
          headImgUrl: user.headImgUrl ?? null,
          subscribeTime: user.subscribeTime ?? null,
          unionId: user.unionId ?? null,
          remark: user.remark ?? null,
          groupId: user.groupId ?? null,
        }));

        return jsonResult({
          action: 'batch_get_user_info',
          requested: validated.openIdList.length,
          count: users.length,
          openids: validated.openIdList,
          users,
        });
      }

      case 'set_remark': {
        if (!validated.openId) {
          throw new Error('set_remark 需要 openId 参数');
        }
        if (validated.remark === undefined) {
          throw new Error('set_remark 需要 remark 参数');
        }

        await apiClient.updateUserRemark(validated.openId, validated.remark);
        return jsonResult({
          action: 'set_remark',
          openid: validated.openId,
          remark: validated.remark,
        });
      }

      case 'get_user_summary': {
        if (!validated.beginDate || !validated.endDate) {
          throw new Error('get_user_summary 需要 beginDate 和 endDate 参数');
        }

        const result = await apiClient.getUserSummary(validated.beginDate, validated.endDate);
        const items = result.list.map(item => ({
          refDate: item.ref_date,
          userSource: item.user_source,
          newUser: item.new_user,
          cancelUser: item.cancel_user,
        }));

        return jsonResult({
          action: 'get_user_summary',
          beginDate: validated.beginDate,
          endDate: validated.endDate,
          count: items.length,
          total: items.length,
          items,
        });
      }

      case 'get_user_cumulate': {
        if (!validated.beginDate || !validated.endDate) {
          throw new Error('get_user_cumulate 需要 beginDate 和 endDate 参数');
        }

        const result = await apiClient.getUserCumulate(validated.beginDate, validated.endDate);
        const items = result.list.map(item => ({
          refDate: item.ref_date,
          cumulateUser: item.cumulate_user,
        }));

        return jsonResult({
          action: 'get_user_cumulate',
          beginDate: validated.beginDate,
          endDate: validated.endDate,
          count: items.length,
          total: items.length,
          items,
        });
      }

      default:
        throw new Error(`未知的操作: ${validated.action}`);
    }
  }
};

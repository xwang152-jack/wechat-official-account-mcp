import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { jsonResult } from '../json-result.js';

// 验证 Schema
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确，应为YYYY-MM-DD');

/**
 * 「发表内容」新接口（官方推荐）
 * 数据存储起始时间 2025-11-01，仅认证账号可调用，数据 T+1（建议次日 8 点后查询）
 */
const NEW_ACTIONS = [
  'get_article_read',
  'get_article_share',
  'get_biz_summary',
  'get_article_total_detail',
] as const;

/**
 * 旧「图文」统计接口
 * 官方已在文档中标注「本接口已停止维护」，保留仅为兼容存量调用
 */
const LEGACY_ACTIONS = [
  'get_article_summary',
  'get_article_total',
  'get_user_read',
  'get_user_share',
  'get_upstream_message',
  'get_interface_summary',
  'get_interface_summary_hour',
] as const;

const STATISTICS_ACTIONS = [...NEW_ACTIONS, ...LEGACY_ACTIONS] as const;

// 无需日期参数的操作
const NO_DATE_ACTIONS: readonly string[] = [];

// 「发表内容」接口限制：日期跨度仅 1 天
const SINGLE_DAY_ACTIONS: readonly string[] = [
  'get_article_read',
  'get_article_share',
  'get_article_total_detail',
];

function parseStatisticsParams(params: unknown) {
  return z.object({
    action: z.enum(STATISTICS_ACTIONS),
    beginDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  }).parse(params);
}

function assertDateRange(action: string, beginDate?: string, endDate?: string): [string, string] {
  if (!beginDate || !endDate) {
    throw new Error(`${action} 操作需要 beginDate 和 endDate 参数（格式 YYYY-MM-DD）`);
  }

  if (SINGLE_DAY_ACTIONS.includes(action) && beginDate !== endDate) {
    throw new Error(
      `${action} 为「发表内容」接口，日期范围仅支持查询 1 天。` +
      `请将 beginDate 与 endDate 设为同一天（当前为 ${beginDate} ~ ${endDate}）`
    );
  }

  return [beginDate, endDate];
}

export const statisticsMcpTool: McpTool = {
  name: 'wechat_statistics',
  description:
    '微信公众号数据统计分析 - 获取发表内容、消息、接口等数据。' +
    '「发表内容」系列（get_article_read / get_article_share / get_biz_summary / get_article_total_detail）' +
    '数据自 2025-11-01 起、仅认证账号可用；旧图文统计系列官方已标注停止维护。',
  inputSchema: {
    action: z.enum(STATISTICS_ACTIONS).describe(
      '操作类型。发表内容系列：get_article_read(每日阅读), get_article_share(每日分享), ' +
      'get_biz_summary(概况总数据,最多30天), get_article_total_detail(发表详细数据)。' +
      '旧图文系列（官方已标注停止维护）：get_article_summary, get_article_total, get_user_read, ' +
      'get_user_share, get_upstream_message, get_interface_summary, get_interface_summary_hour'
    ),
    beginDate: dateSchema.optional().describe('起始日期 YYYY-MM-DD'),
    endDate: dateSchema.optional().describe('结束日期 YYYY-MM-DD（最大值为昨日）'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    const validated = parseStatisticsParams(params);
    const { action } = validated;

    if (!NO_DATE_ACTIONS.includes(action)) {
      assertDateRange(action, validated.beginDate, validated.endDate);
    }

    switch (action) {
      // ==================== 发表内容（官方推荐） ====================

      case 'get_article_read': {
        const result = await apiClient.getArticleRead(validated.beginDate!, validated.endDate!);

        if (!result.list?.length) {
          return jsonResult({
            action: 'get_article_read',
            beginDate: validated.beginDate!,
            endDate: validated.endDate!,
            isDelay: result.is_delay ?? null,
            count: 0,
            items: [],
          });
        }

        return jsonResult({
          action: 'get_article_read',
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          isDelay: result.is_delay ?? null,
          count: result.list.length,
          items: result.list.map(item => ({
            refDate: item.ref_date,
            msgid: item.msgid,
            readUser: item.detail?.read_user ?? null,
            readUserSource: (item.detail?.read_user_source ?? []).map(s => ({
              userCount: s.user_count,
              sceneDesc: s.scene_desc,
            })),
          })),
        });
      }

      case 'get_article_share': {
        const result = await apiClient.getArticleShare(validated.beginDate!, validated.endDate!);

        if (!result.list?.length) {
          return jsonResult({
            action: 'get_article_share',
            beginDate: validated.beginDate!,
            endDate: validated.endDate!,
            isDelay: result.is_delay ?? null,
            count: 0,
            items: [],
          });
        }

        return jsonResult({
          action: 'get_article_share',
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          isDelay: result.is_delay ?? null,
          count: result.list.length,
          items: result.list.map(item => ({
            refDate: item.ref_date,
            msgid: item.msgid,
            shareUser: item.detail?.share_user ?? null,
          })),
        });
      }

      case 'get_biz_summary': {
        const result = await apiClient.getBizSummary(validated.beginDate!, validated.endDate!);

        if (!result.list?.length) {
          return jsonResult({
            action: 'get_biz_summary',
            beginDate: validated.beginDate!,
            endDate: validated.endDate!,
            isDelay: result.is_delay ?? null,
            count: 0,
            items: [],
          });
        }

        return jsonResult({
          action: 'get_biz_summary',
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          isDelay: result.is_delay ?? null,
          count: result.list.length,
          items: result.list.map(item => {
            const d = item.detail || {} as any;
            return {
              refDate: item.ref_date,
              sendPageCount: d.send_page_count ?? null,
              readUser: d.read_user ?? null,
              shareUser: d.share_user ?? null,
              zaikanUser: d.zaikan_user ?? null,
              likeUser: d.like_user ?? null,
              commentCount: d.comment_count ?? null,
              collectionUser: d.collection_user ?? null,
              redirectOriPageUser: d.redirect_ori_page_user ?? null,
              readUserSource: (d.read_user_source ?? []).map((s: any) => ({
                userCount: s.user_count,
                sceneDesc: s.scene_desc,
              })),
            };
          }),
        });
      }

      case 'get_article_total_detail': {
        const result = await apiClient.getArticleTotalDetail(validated.beginDate!, validated.endDate!);

        if (!result.list?.length) {
          return jsonResult({
            action: 'get_article_total_detail',
            beginDate: validated.beginDate!,
            endDate: validated.endDate!,
            isDelay: result.is_delay ?? null,
            count: 0,
            items: [],
          });
        }

        return jsonResult({
          action: 'get_article_total_detail',
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          isDelay: result.is_delay ?? null,
          count: result.list.length,
          items: result.list.map(item => ({
            refDate: item.ref_date,
            msgid: item.msgid,
            title: item.title || null,
            publishType: item.publish_type ?? null,
            contentUrl: item.content_url || null,
            detailList: (item.detail_list ?? []).map(d => ({
              statDate: d.stat_date,
              readUser: d.read_user ?? null,
              readUserSource: (d.read_user_source ?? []).map(s => ({
                userCount: s.user_count,
                sceneDesc: s.scene_desc,
              })),
              shareUser: d.share_user ?? null,
              zaikanUser: d.zaikan_user ?? null,
              likeUser: d.like_user ?? null,
              commentCount: d.comment_count ?? null,
              collectionUser: d.collection_user ?? null,
              praiseMoney: d.praise_money ?? null,
              readSubscribeUser: d.read_subscribe_user ?? null,
              readDeliveryRate: d.read_delivery_rate ?? null,
              readFinishRate: d.read_finish_rate ?? null,
              readAvgActivetime: d.read_avg_activetime ?? null,
            })),
          })),
          note: '每篇内容仅统计发表日期起 30 天内的数据',
        });
      }

      // ==================== 旧图文统计（已停止维护） ====================

      case 'get_article_summary': {
        const result = await apiClient.getArticleSummary(validated.beginDate!, validated.endDate!);

        return jsonResult({
          action: 'get_article_summary',
          deprecated: true,
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          count: result.list.length,
          items: result.list.map(item => ({
            refDate: item.ref_date,
            msgid: item.msgid,
            title: item.title || null,
            intPageReadUser: item.int_page_read_user ?? null,
            intPageReadCount: item.int_page_read_count ?? null,
            oriPageReadUser: item.ori_page_read_user ?? null,
            oriPageReadCount: item.ori_page_read_count ?? null,
            shareUser: item.share_user ?? null,
            shareCount: item.share_count ?? null,
            addToFavUser: item.add_to_fav_user ?? null,
            addToFavCount: item.add_to_fav_count ?? null,
          })),
        });
      }

      case 'get_article_total': {
        const result = await apiClient.getArticleTotal(validated.beginDate!, validated.endDate!);

        return jsonResult({
          action: 'get_article_total',
          deprecated: true,
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          count: result.list.length,
          items: result.list.map(item => ({
            refDate: item.ref_date,
            msgid: item.msgid,
            title: item.title || null,
            details: (item.details ?? []).map(d => ({
              statDate: d.stat_date,
              targetUser: d.target_user ?? null,
              intPageReadUser: d.int_page_read_user ?? null,
              intPageReadCount: d.int_page_read_count ?? null,
              oriPageReadUser: d.ori_page_read_user ?? null,
              oriPageReadCount: d.ori_page_read_count ?? null,
              shareUser: d.share_user ?? null,
              shareCount: d.share_count ?? null,
              addToFavUser: d.add_to_fav_user ?? null,
              addToFavCount: d.add_to_fav_count ?? null,
            })),
          })),
          note: 'details 中每天数值为「文章从群发日到该日的累计总量」，非当日量',
        });
      }

      case 'get_user_read': {
        const result = await apiClient.getUserRead(validated.beginDate!, validated.endDate!);

        return jsonResult({
          action: 'get_user_read',
          deprecated: true,
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          count: result.list.length,
          items: result.list.map(item => ({
            refDate: item.ref_date,
            userSource: item.user_source ?? null,
            intPageReadUser: item.int_page_read_user ?? null,
            intPageReadCount: item.int_page_read_count ?? null,
            oriPageReadUser: item.ori_page_read_user ?? null,
            oriPageReadCount: item.ori_page_read_count ?? null,
            shareUser: item.share_user ?? null,
            shareCount: item.share_count ?? null,
            addToFavUser: item.add_to_fav_user ?? null,
            addToFavCount: item.add_to_fav_count ?? null,
          })),
        });
      }

      case 'get_user_share': {
        const result = await apiClient.getUserShare(validated.beginDate!, validated.endDate!);

        return jsonResult({
          action: 'get_user_share',
          deprecated: true,
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          count: result.list.length,
          items: result.list.map(item => ({
            refDate: item.ref_date,
            sharePage: item.share_page ?? null,
            shareUser: item.share_user ?? null,
            shareCount: item.share_count ?? null,
          })),
        });
      }

      case 'get_upstream_message': {
        const result = await apiClient.getUpstreamMessage(validated.beginDate!, validated.endDate!);

        return jsonResult({
          action: 'get_upstream_message',
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          count: result.list.length,
          items: result.list.map(item => ({
            refDate: item.ref_date,
            msgType: item.msg_type ?? null,
            msgUser: item.msg_user ?? null,
            msgCount: item.msg_count ?? null,
          })),
        });
      }

      case 'get_interface_summary': {
        const result = await apiClient.getInterfaceSummary(validated.beginDate!, validated.endDate!);

        return jsonResult({
          action: 'get_interface_summary',
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          count: result.list.length,
          items: result.list.map(item => ({
            refDate: item.ref_date,
            callbackCount: item.callback_count ?? null,
            failCount: item.fail_count ?? null,
            totalTime: item.total_time ?? null,
            maxTime: item.max_time ?? null,
          })),
        });
      }

      case 'get_interface_summary_hour': {
        const result = await apiClient.getInterfaceSummaryHour(validated.beginDate!, validated.endDate!);
        const items = result.list.slice(0, 24).map(item => ({
          refDate: item.ref_date,
          refHour: item.ref_hour ?? null,
          callbackCount: item.callback_count ?? null,
          failCount: item.fail_count ?? null,
          totalTime: item.total_time ?? null,
          maxTime: item.max_time ?? null,
        }));

        return jsonResult({
          action: 'get_interface_summary_hour',
          beginDate: validated.beginDate!,
          endDate: validated.endDate!,
          count: items.length,
          total: result.list.length,
          truncated: result.list.length > items.length,
          items,
        });
      }

      default:
        throw new Error(`未知的操作: ${action}`);
    }
  },
};

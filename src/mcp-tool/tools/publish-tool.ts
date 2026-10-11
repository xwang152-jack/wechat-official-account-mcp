import { z } from 'zod';
import { WechatToolDefinition, WechatToolContext, WechatToolResult, McpTool, WechatApiClient } from '../types.js';
import { jsonResult } from '../json-result.js';

// 发布工具参数 Schema
const publishToolSchema = z.object({
  action: z.enum(['submit', 'get', 'delete', 'list']),
  mediaId: z.string().optional(),
  publishId: z.string().optional(),
  offset: z.number().optional(),
  count: z.number().optional(),
});

/**
 * 发布状态映射（官方 freepublish/get：publish_status）
 */
const PUBLISH_STATUS_MAP: Record<number, string> = {
  0: '成功',
  1: '发布中',
  2: '原创失败',
  3: '常规失败',
  4: '平台审核不通过',
  5: '成功后用户删除所有文章',
  6: '成功后系统封禁所有文章',
};

/**
 * 发布工具核心处理逻辑
 */
async function handlePublishCore(
  action: string,
  params: {
    mediaId?: string;
    publishId?: string;
    offset?: number;
    count?: number;
  },
  apiClient: WechatApiClient
): Promise<WechatToolResult> {
  switch (action) {
    case 'submit': {
      const { mediaId } = params;

      if (!mediaId) {
        throw new Error('草稿ID不能为空');
      }

      const result = await apiClient.post('/cgi-bin/freepublish/submit', {
        media_id: mediaId
      }) as any;

      return jsonResult({
        action: 'submit',
        publishId: result.publish_id ?? null,
        mediaId,
      });
    }

    case 'get': {
      const { publishId } = params;

      if (!publishId) {
        throw new Error('发布ID不能为空');
      }

      const result = await apiClient.post('/cgi-bin/freepublish/get', {
        publish_id: publishId
      }) as any;

      // article_detail 仅在发布成功（publish_status=0）时返回
      const items: any[] = result.article_detail?.item || [];

      return jsonResult({
        action: 'get',
        publishId,
        publishStatus: result.publish_status ?? null,
        publishStatusText: PUBLISH_STATUS_MAP[result.publish_status] ?? null,
        articleId: result.article_id || null,
        articleCount: result.article_detail?.count ?? 0,
        articles: items.map((item: any) => ({
          idx: item.idx ?? null,
          articleUrl: item.article_url || null,
        })),
        failIdx: result.fail_idx ?? [],
      });
    }

    case 'delete': {
      const { publishId: deletePublishId } = params;

      if (!deletePublishId) {
        throw new Error('发布ID不能为空');
      }

      await apiClient.post('/cgi-bin/freepublish/delete', {
        publish_id: deletePublishId
      }) as any;

      return jsonResult({
        action: 'delete',
        publishId: deletePublishId,
        deleted: true,
      });
    }

    case 'list': {
      const { offset = 0, count = 20 } = params;

      const result = await apiClient.post('/cgi-bin/freepublish/batchget', {
        offset,
        count
      }) as any;

      // batchget 返回的是已成功发布的内容，不含 publish_status 字段
      const items = (result.item || []).map((item: any) => {
        const newsItems: any[] = item.content?.news_item || [];
        const firstArticle = newsItems[0] || {};

        return {
          articleId: item.article_id ?? null,
          title: firstArticle.title || null,
          author: firstArticle.author || null,
          articleCount: newsItems.length,
          deleted: firstArticle.is_deleted ?? null,
          url: firstArticle.url || null,
          updateTime: item.update_time ? new Date(item.update_time * 1000).toISOString() : null,
        };
      });

      return jsonResult({
        action: 'list',
        offset,
        count: items.length,
        itemCount: result.item_count ?? null,
        total: result.total_count ?? null,
        truncated: typeof result.total_count === 'number' ? result.total_count > offset + items.length : false,
        items,
      });
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * 发布工具处理器 (WechatToolContext)
 */
async function handlePublishTool(context: WechatToolContext): Promise<WechatToolResult> {
  const { args, apiClient } = context;
  const validatedArgs = publishToolSchema.parse(args);
  const { action, mediaId, publishId, offset, count } = validatedArgs;

  return handlePublishCore(action, { mediaId, publishId, offset, count }, apiClient);
}

/**
 * MCP发布工具处理器
 */
async function handlePublishMcpTool(args: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> {
  const validatedArgs = publishToolSchema.parse(args);
  const { action, mediaId, publishId, offset, count } = validatedArgs;

  return handlePublishCore(action, { mediaId, publishId, offset, count }, apiClient);
}

/**
 * 微信公众号发布工具
 */
export const publishTool: WechatToolDefinition = {
  name: 'wechat_publish',
  description: '管理微信公众号文章发布',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['submit', 'get', 'delete', 'list'],
        description: '操作类型',
      },
      mediaId: {
        type: 'string',
        description: '草稿 Media ID',
      },
      publishId: {
        type: 'string',
        description: '发布 ID',
      },
    },
    required: ['action'],
  },
  handler: handlePublishTool,
};

/**
 * MCP发布工具
 */
export const publishMcpTool: McpTool = {
  name: 'wechat_publish',
  description:
    '管理微信公众号文章发布（freepublish）。注意：自 2025 年 7 月起，个人主体、企业未认证主体已被回收发布接口权限，' +
    '公众号（原订阅号）需完成微信认证方可调用，服务号可直接调用。',
  inputSchema: {
    action: z.enum(['submit', 'get', 'delete', 'list']).describe('操作类型：submit(提交发布), get(查询状态), delete(删除发布), list(发布列表)'),
    mediaId: z.string().optional().describe('草稿 Media ID（提交发布时必需）'),
    publishId: z.string().optional().describe('发布 ID（查询状态、删除时必需）'),
    offset: z.number().optional().describe('偏移量（列表时使用）'),
    count: z.number().optional().describe('数量（列表时使用，1-20）'),
  },
  handler: handlePublishMcpTool,
};

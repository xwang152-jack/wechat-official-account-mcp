import { z } from 'zod';
import { WechatToolDefinition, WechatToolContext, WechatToolResult, McpTool, WechatApiClient } from '../types.js';

// 发布工具参数 Schema
const publishToolSchema = z.object({
  action: z.enum(['submit', 'get', 'delete', 'list']),
  mediaId: z.string().optional(),
  publishId: z.string().optional(),
  offset: z.number().optional(),
  count: z.number().optional(),
});

// 发布状态映射（模块级常量）
const PUBLISH_STATUS_MAP: Record<number, string> = {
  0: '成功',
  1: '发布失败',
  2: '发布成功',
  3: '发布中',
  4: '原创失败'
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

      return {
        content: [{
          type: 'text',
          text: `发布提交成功！\n发布ID: ${result.publish_id}\n草稿ID: ${mediaId}\n\n注意：发布结果将通过事件推送通知，请关注推送消息。`,
        }],
      };
    }

    case 'get': {
      const { publishId } = params;

      if (!publishId) {
        throw new Error('发布ID不能为空');
      }

      const result = await apiClient.post('/cgi-bin/freepublish/get', {
        publish_id: publishId
      }) as any;

      const firstArticle = result.article_detail.item[0];
      const articleCount = result.article_detail.count;

      return {
        content: [{
          type: 'text',
          text: `发布状态查询成功！\n` +
                `发布ID: ${publishId}\n` +
                `发布状态: ${PUBLISH_STATUS_MAP[result.publish_status] || '未知状态'}\n` +
                `文章数量: ${articleCount}\n` +
                `首篇标题: ${firstArticle.title}\n` +
                `作者: ${firstArticle.author || '未设置'}\n` +
                `文章链接: ${firstArticle.url || '暂无'}\n` +
                `发布时间: ${result.article_detail.create_time ? new Date(result.article_detail.create_time * 1000).toLocaleString() : '未发布'}`,
        }],
      };
    }

    case 'delete': {
      const { publishId: deletePublishId } = params;

      if (!deletePublishId) {
        throw new Error('发布ID不能为空');
      }

      await apiClient.post('/cgi-bin/freepublish/delete', {
        publish_id: deletePublishId
      }) as any;

      return {
        content: [{
          type: 'text',
          text: `发布删除成功！\n发布ID: ${deletePublishId}\n\n注意：删除发布不会删除草稿，如需删除草稿请使用草稿管理工具。`,
        }],
      };
    }

    case 'list': {
      const { offset = 0, count = 20 } = params;

      const result = await apiClient.post('/cgi-bin/freepublish/batchget', {
        offset,
        count
      }) as any;

      const publishList = result.item.map((item: any, index: number) => {
        const firstArticle = item.article_detail.item[0];
        const articleCount = item.article_detail.count;

        return `${offset + index + 1}. 发布ID: ${item.publish_id}\n` +
               `   状态: ${PUBLISH_STATUS_MAP[item.publish_status] || '未知状态'}\n` +
               `   标题: ${firstArticle.title}${articleCount > 1 ? ` (共${articleCount}篇)` : ''}\n` +
               `   作者: ${firstArticle.author || '未设置'}\n` +
               `   发布时间: ${item.article_detail.create_time ? new Date(item.article_detail.create_time * 1000).toLocaleString() : '未发布'}\n` +
               `   文章链接: ${firstArticle.url || '暂无'}`;
      }).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `发布列表 (${offset + 1}-${offset + result.item.length}/${result.total_count}):\n\n${publishList}`,
        }],
      };
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
  description: '管理微信公众号文章发布',
  inputSchema: {
    action: z.enum(['submit', 'get', 'delete', 'list']).describe('操作类型：submit(提交发布), get(查询状态), delete(删除发布), list(发布列表)'),
    mediaId: z.string().optional().describe('草稿 Media ID（提交发布时必需）'),
    publishId: z.string().optional().describe('发布 ID（查询状态、删除时必需）'),
    offset: z.number().optional().describe('偏移量（列表时使用）'),
    count: z.number().optional().describe('数量（列表时使用）'),
  },
  handler: handlePublishMcpTool,
};

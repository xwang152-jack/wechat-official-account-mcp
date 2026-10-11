import { WechatToolDefinition, McpTool, WechatApiClient, WechatToolContext, WechatToolResult } from '../types.js';
import { z } from 'zod';
import { draftArticleSchema, mediaIdSchema } from '../../utils/validation.js';
import { jsonResult } from '../json-result.js';

// 草稿工具参数 Schema
const draftToolSchema = z.object({
  action: z.enum(['add', 'update', 'get', 'delete', 'list', 'count']),
  mediaId: mediaIdSchema.optional(),
  index: z.number().int().min(0).optional(),
  articles: z.array(draftArticleSchema).optional(),
  offset: z.number().int().min(0).optional(),
  count: z.number().int().min(1).max(20).optional(),
});

/**
 * 跨字段校验：news 必须有封面图，newspic 必须有图片列表
 */
function assertArticleShape(article: any) {
  const articleType = article.articleType || 'news';

  if (articleType === 'newspic') {
    if (!article.imageInfo?.imageList?.length) {
      throw new Error('图片消息（articleType: newspic）必须提供 imageInfo.imageList（最多20张，首张为封面）');
    }
    return;
  }

  if (!article.thumbMediaId) {
    throw new Error('图文消息（articleType: news）必须提供 thumbMediaId 作为封面图素材ID');
  }
}

/**
 * 将工具层驼峰参数映射为微信接口的下划线字段
 */
function formatDraftArticle(article: any) {
  const formatted: Record<string, any> = {
    article_type: article.articleType || 'news',
    title: article.title,
    author: article.author || '',
    digest: article.digest || '',
    content: article.content,
    content_source_url: article.contentSourceUrl || '',
    show_cover_pic: article.showCoverPic || 0,
    need_open_comment: article.needOpenComment || 0,
    only_fans_can_comment: article.onlyFansCanComment || 0,
  };

  if (article.thumbMediaId) {
    formatted.thumb_media_id = article.thumbMediaId;
  }

  if (article.imageInfo?.imageList?.length) {
    formatted.image_info = {
      image_list: article.imageInfo.imageList.map((img: any) => ({
        image_media_id: img.imageMediaId,
      })),
    };
  }

  if (article.coverInfo?.cropPercentList?.length) {
    formatted.cover_info = {
      crop_percent_list: article.coverInfo.cropPercentList.map((crop: any) => ({
        ratio: crop.ratio,
        x1: crop.x1,
        y1: crop.y1,
        x2: crop.x2,
        y2: crop.y2,
      })),
    };
  }

  if (article.productInfo?.footerProductInfo?.productKey) {
    formatted.product_info = {
      footer_product_info: {
        product_key: article.productInfo.footerProductInfo.productKey,
      },
    };
  }

  return formatted;
}

/**
 * 草稿工具核心处理逻辑
 * 统一处理所有草稿相关操作
 */
async function handleDraftOperations(
  action: string,
  params: {
    mediaId?: string;
    index?: number;
    articles?: any[];
    offset?: number;
    count?: number;
  },
  apiClient: WechatApiClient
): Promise<WechatToolResult> {
  switch (action) {
    case 'add': {
      const { articles } = params;

      if (!articles || articles.length === 0) {
        throw new Error('文章内容不能为空');
      }

      articles.forEach(assertArticleShape);

      const result = await apiClient.post('/cgi-bin/draft/add', {
        articles: articles.map((article: any) => formatDraftArticle(article))
      }) as any;

      return jsonResult({
        action: 'add',
        mediaId: result.media_id,
        articleCount: articles.length,
      });
    }

    case 'update': {
      const { mediaId, index, articles } = params;

      if (!mediaId) {
        throw new Error('草稿ID不能为空');
      }

      if (index === undefined) {
        throw new Error('更新草稿时必须提供文章索引 index');
      }

      if (!articles || articles.length !== 1) {
        throw new Error('更新草稿时必须提供且仅提供一篇文章内容');
      }

      assertArticleShape(articles[0]);

      await apiClient.post('/cgi-bin/draft/update', {
        media_id: mediaId,
        index,
        articles: formatDraftArticle(articles[0]),
      }) as any;

      return jsonResult({
        action: 'update',
        mediaId,
        index,
        articleCount: 1,
      });
    }

    case 'get': {
      const { mediaId } = params;

      if (!mediaId) {
        throw new Error('草稿ID不能为空');
      }

      const result = await apiClient.post('/cgi-bin/draft/get', {
        media_id: mediaId
      }) as any;

      const articles = result.news_item.map((item: any, index: number) => ({
        index,
        title: item.title ?? null,
        author: item.author || null,
        digest: item.digest || null,
        content: item.content ?? null,
        contentSourceUrl: item.content_source_url || null,
        thumbMediaId: item.thumb_media_id ?? null,
        showCoverPic: item.show_cover_pic ?? null,
        articleType: item.article_type ?? null,
        imageInfo: item.image_info ?? null,
      }));

      return jsonResult({
        action: 'get',
        mediaId,
        createTime: result.create_time ? new Date(result.create_time * 1000).toISOString() : null,
        updateTime: result.update_time ? new Date(result.update_time * 1000).toISOString() : null,
        articleCount: articles.length,
        articles,
      });
    }

    case 'delete': {
      const { mediaId } = params;

      if (!mediaId) {
        throw new Error('草稿ID不能为空');
      }

      await apiClient.post('/cgi-bin/draft/delete', {
        media_id: mediaId
      }) as any;

      return jsonResult({
        action: 'delete',
        mediaId,
        deleted: true,
      });
    }

    case 'list': {
      const { offset = 0, count = 20 } = params;

      const result = await apiClient.post('/cgi-bin/draft/batchget', {
        offset,
        count
      }) as any;

      const items = result.item.map((item: any) => {
        const newsItems: any[] = item.content.news_item;
        const firstArticle = newsItems[0];

        return {
          mediaId: item.media_id,
          title: firstArticle.title ?? null,
          author: firstArticle.author || null,
          articleCount: newsItems.length,
          createTime: item.content.create_time ? new Date(item.content.create_time * 1000).toISOString() : null,
          updateTime: item.content.update_time ? new Date(item.content.update_time * 1000).toISOString() : null,
        };
      });

      return jsonResult({
        action: 'list',
        offset,
        count: items.length,
        total: result.total_count ?? null,
        truncated: typeof result.total_count === 'number' ? result.total_count > offset + items.length : false,
        items,
      });
    }

    case 'count': {
      const result = await apiClient.post('/cgi-bin/draft/count') as any;

      return jsonResult({
        action: 'count',
        totalCount: result.total_count ?? null,
      });
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * 草稿工具处理器 (WechatToolContext)
 */
async function handleDraftTool(context: WechatToolContext): Promise<WechatToolResult> {
  const { args, apiClient } = context;
  const validatedArgs = draftToolSchema.parse(args);
  const { action, mediaId, index, articles, offset, count } = validatedArgs;

  return handleDraftOperations(action, { mediaId, index, articles, offset, count }, apiClient);
}

/**
 * MCP草稿工具处理器 (直接参数)
 */
async function handleDraftMcpTool(args: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> {
  const validatedArgs = draftToolSchema.parse(args);
  const { action, mediaId, index, articles, offset, count } = validatedArgs;

  return handleDraftOperations(action, { mediaId, index, articles, offset, count }, apiClient);
}

/**
 * 微信公众号草稿管理工具
 */
export const draftTool: WechatToolDefinition = {
  name: 'wechat_draft',
  description: '管理微信公众号草稿',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'update', 'get', 'delete', 'list', 'count'],
        description: '操作类型',
      },
      mediaId: {
        type: 'string',
        description: '草稿 Media ID',
      },
      index: {
        type: 'number',
        description: '草稿文章索引（update 时必需）',
      },
    },
    required: ['action'],
  },
  handler: handleDraftTool,
};

/**
 * MCP草稿工具
 */
export const draftMcpTool: McpTool = {
  name: 'wechat_draft',
  description: '管理微信公众号草稿。支持图文消息（news）与图片消息（newspic），图片消息可挂商品卡片。',
  inputSchema: {
    action: z.enum(['add', 'update', 'get', 'delete', 'list', 'count']).describe('操作类型：add(创建), update(更新), get(获取), delete(删除), list(列表), count(统计)'),
    mediaId: z.string().optional().describe('草稿 Media ID（get、update、delete 时必需）'),
    index: z.number().int().min(0).optional().describe('草稿中的文章索引（update 时必需）'),
    articles: z.array(draftArticleSchema).optional().describe(
      '文章列表（add 时可传多篇，update 时必须且仅能传一篇）。' +
      'articleType 省略时为 news，需提供 thumbMediaId；传 newspic 时需提供 imageInfo.imageList。' +
      'coverInfo 控制封面裁剪，productInfo.footerProductInfo.productKey 在文末挂商品卡片。'
    ),
    offset: z.number().optional().describe('偏移量（列表时使用）'),
    count: z.number().optional().describe('数量（列表时使用）'),
  },
  handler: handleDraftMcpTool,
};

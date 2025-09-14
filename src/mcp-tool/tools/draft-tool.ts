import { WechatToolDefinition, McpTool, WechatApiClient, WechatToolContext, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

// 草稿工具参数 Schema
const draftToolSchema = z.object({
  action: z.enum(['add', 'get', 'delete', 'list', 'count']),
  mediaId: z.string().optional(),
  articles: z.array(z.object({
    title: z.string(),
    author: z.string().optional(),
    digest: z.string().optional(),
    content: z.string(),
    contentSourceUrl: z.string().optional(),
    thumbMediaId: z.string(),
    showCoverPic: z.number().optional(),
    needOpenComment: z.number().optional(),
    onlyFansCanComment: z.number().optional(),
  })).optional(),
  offset: z.number().optional(),
  count: z.number().optional(),
});

/**
 * 草稿工具处理器
 */
async function handleDraftTool(context: WechatToolContext): Promise<WechatToolResult> {
  const { args, apiClient } = context;
  
  try {
    const validatedArgs = draftToolSchema.parse(args);
    const { action } = validatedArgs;

    switch (action) {
      case 'add': {
        const { articles } = validatedArgs;
        
        if (!articles || articles.length === 0) {
          throw new Error('文章内容不能为空');
        }
        
        try {
          const result = await apiClient.post('/cgi-bin/draft/add', {
            articles: articles.map(article => ({
              title: article.title,
              author: article.author || '',
              digest: article.digest || '',
              content: article.content,
              content_source_url: article.contentSourceUrl || '',
              thumb_media_id: article.thumbMediaId,
              show_cover_pic: article.showCoverPic || 0,
              need_open_comment: article.needOpenComment || 0,
              only_fans_can_comment: article.onlyFansCanComment || 0,
            }))
          }) as any;
          
          return {
            content: [{
              type: 'text',
              text: `草稿创建成功！\n草稿ID: ${result.media_id}\n包含文章数: ${articles.length}`,
            }],
          };
        } catch (error) {
          throw new Error(`创建草稿失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'get': {
        const { mediaId } = validatedArgs;
        
        if (!mediaId) {
          throw new Error('草稿ID不能为空');
        }
        
        try {
          const result = await apiClient.post('/cgi-bin/draft/get', {
            media_id: mediaId
          }) as any;
          
          const articles = result.news_item.map((item: any, index: number) => 
            `第${index + 1}篇:\n` +
            `标题: ${item.title}\n` +
            `作者: ${item.author || '未设置'}\n` +
            `摘要: ${item.digest || '无'}\n` +
            `内容: ${item.content.substring(0, 100)}${item.content.length > 100 ? '...' : ''}\n` +
            `原文链接: ${item.content_source_url || '无'}\n` +
            `封面图ID: ${item.thumb_media_id}\n` +
            `显示封面: ${item.show_cover_pic ? '是' : '否'}\n`
          ).join('\n');
          
          return {
            content: [{
              type: 'text',
              text: `获取草稿成功！\n草稿ID: ${mediaId}\n创建时间: ${new Date(result.create_time * 1000).toLocaleString()}\n更新时间: ${new Date(result.update_time * 1000).toLocaleString()}\n\n${articles}`,
            }],
          };
        } catch (error) {
          throw new Error(`获取草稿失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'delete': {
        const { mediaId: deleteMediaId } = validatedArgs;
        
        if (!deleteMediaId) {
          throw new Error('草稿ID不能为空');
        }
        
        try {
          await apiClient.post('/cgi-bin/draft/delete', {
            media_id: deleteMediaId
          }) as any;
          
          return {
            content: [{
              type: 'text',
              text: `草稿删除成功！\n草稿ID: ${deleteMediaId}`,
            }],
          };
        } catch (error) {
          throw new Error(`删除草稿失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'list': {
        const { offset = 0, count = 20 } = validatedArgs;
        
        try {
          const result = await apiClient.post('/cgi-bin/draft/batchget', {
            offset,
            count
          }) as any;
          
          const draftList = result.item.map((item: any, index: number) => {
            const firstArticle = item.content.news_item[0];
            const articleCount = item.content.news_item.length;
            
            return `${offset + index + 1}. 草稿ID: ${item.media_id}\n` +
                   `   标题: ${firstArticle.title}${articleCount > 1 ? ` (共${articleCount}篇)` : ''}\n` +
                   `   作者: ${firstArticle.author || '未设置'}\n` +
                   `   创建时间: ${new Date(item.content.create_time * 1000).toLocaleString()}\n` +
                   `   更新时间: ${new Date(item.content.update_time * 1000).toLocaleString()}`;
          }).join('\n\n');
          
          return {
            content: [{
              type: 'text',
              text: `草稿列表 (${offset + 1}-${offset + result.item.length}/${result.total_count}):\n\n${draftList}`,
            }],
          };
        } catch (error) {
          throw new Error(`获取草稿列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'count': {
        try {
          const result = await apiClient.post('/cgi-bin/draft/count') as any;
          
          return {
            content: [{
              type: 'text',
              text: `草稿统计信息：\n草稿总数: ${result.total_count} 个`,
            }],
          };
        } catch (error) {
          throw new Error(`获取草稿统计失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logger.error('Draft tool error:', error);
    return {
      content: [{
        type: 'text',
        text: `草稿操作失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }],
      isError: true,
    };
  }
}

/**
 * MCP草稿工具处理器
 */
async function handleDraftMcpTool(args: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> {
  const { action, mediaId, articles, offset = 0, count = 20 } = args as any;
  
  try {
    switch (action) {
      case 'add': {
        if (!articles || articles.length === 0) {
          throw new Error('文章内容不能为空');
        }
        
        try {
          const result = await apiClient.post('/cgi-bin/draft/add', {
            articles: articles.map((article: any) => ({
              title: article.title,
              author: article.author || '',
              digest: article.digest || '',
              content: article.content,
              content_source_url: article.contentSourceUrl || '',
              thumb_media_id: article.thumbMediaId,
              show_cover_pic: article.showCoverPic || 0,
              need_open_comment: article.needOpenComment || 0,
              only_fans_can_comment: article.onlyFansCanComment || 0,
            }))
          }) as any;
          
          return {
            content: [{
              type: 'text',
              text: `草稿创建成功！\n草稿ID: ${result.media_id}\n包含文章数: ${articles.length}`,
            }],
          };
        } catch (error) {
          throw new Error(`创建草稿失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'get': {
        if (!mediaId) {
          throw new Error('草稿ID不能为空');
        }
        
        try {
          const result = await apiClient.post('/cgi-bin/draft/get', {
            media_id: mediaId
          }) as any;
          
          const articles = result.news_item.map((item: any, index: number) => 
            `第${index + 1}篇:\n` +
            `标题: ${item.title}\n` +
            `作者: ${item.author || '未设置'}\n` +
            `摘要: ${item.digest || '无'}\n` +
            `内容: ${item.content.substring(0, 100)}${item.content.length > 100 ? '...' : ''}\n` +
            `原文链接: ${item.content_source_url || '无'}\n` +
            `封面图ID: ${item.thumb_media_id}\n` +
            `显示封面: ${item.show_cover_pic ? '是' : '否'}\n`
          ).join('\n');
          
          return {
            content: [{
              type: 'text',
              text: `获取草稿成功！\n草稿ID: ${mediaId}\n创建时间: ${new Date(result.create_time * 1000).toLocaleString()}\n更新时间: ${new Date(result.update_time * 1000).toLocaleString()}\n\n${articles}`,
            }],
          };
        } catch (error) {
          throw new Error(`获取草稿失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'delete': {
        if (!mediaId) {
          throw new Error('草稿ID不能为空');
        }
        
        try {
          await apiClient.post('/cgi-bin/draft/delete', {
            media_id: mediaId
          }) as any;
          
          return {
            content: [{
              type: 'text',
              text: `草稿删除成功！\n草稿ID: ${mediaId}`,
            }],
          };
        } catch (error) {
          throw new Error(`删除草稿失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'list': {
        try {
          const result = await apiClient.post('/cgi-bin/draft/batchget', {
            offset,
            count
          }) as any;
          
          const draftList = result.item.map((item: any, index: number) => {
            const firstArticle = item.content.news_item[0];
            const articleCount = item.content.news_item.length;
            
            return `${offset + index + 1}. 草稿ID: ${item.media_id}\n` +
                   `   标题: ${firstArticle.title}${articleCount > 1 ? ` (共${articleCount}篇)` : ''}\n` +
                   `   作者: ${firstArticle.author || '未设置'}\n` +
                   `   创建时间: ${new Date(item.content.create_time * 1000).toLocaleString()}\n` +
                   `   更新时间: ${new Date(item.content.update_time * 1000).toLocaleString()}`;
          }).join('\n\n');
          
          return {
            content: [{
              type: 'text',
              text: `草稿列表 (${offset + 1}-${offset + result.item.length}/${result.total_count}):\n\n${draftList}`,
            }],
          };
        } catch (error) {
          throw new Error(`获取草稿列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'count': {
        try {
          const result = await apiClient.post('/cgi-bin/draft/count') as any;
          
          return {
            content: [{
              type: 'text',
              text: `草稿统计信息：\n草稿总数: ${result.total_count} 个`,
            }],
          };
        } catch (error) {
          throw new Error(`获取草稿统计失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logger.error('Draft MCP tool error:', error);
    return {
      content: [{
        type: 'text',
        text: `草稿操作失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }],
      isError: true,
    };
  }
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
        enum: ['add', 'get', 'delete', 'list', 'count'],
        description: '操作类型',
      },
      mediaId: {
        type: 'string',
        description: '草稿 Media ID',
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
  description: '管理微信公众号草稿',
  inputSchema: {
    action: z.enum(['add', 'get', 'delete', 'list', 'count']).describe('操作类型：add(创建), get(获取), delete(删除), list(列表), count(统计)'),
    mediaId: z.string().optional().describe('草稿 Media ID（获取、删除时必需）'),
    articles: z.array(z.object({
      title: z.string().describe('文章标题'),
      author: z.string().optional().describe('作者'),
      digest: z.string().optional().describe('摘要'),
      content: z.string().describe('文章内容'),
      contentSourceUrl: z.string().optional().describe('原文链接'),
      thumbMediaId: z.string().describe('封面图片媒体ID'),
      showCoverPic: z.number().optional().describe('是否显示封面图片'),
      needOpenComment: z.number().optional().describe('是否开启评论'),
      onlyFansCanComment: z.number().optional().describe('是否仅粉丝可评论'),
    })).optional().describe('文章列表（创建时必需）'),
    offset: z.number().optional().describe('偏移量（列表时使用）'),
    count: z.number().optional().describe('数量（列表时使用）'),
  },
  handler: handleDraftMcpTool,
};
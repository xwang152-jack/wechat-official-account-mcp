import { z } from 'zod';
import { WechatToolDefinition, WechatToolContext, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// 发布工具参数 Schema
const publishToolSchema = z.object({
  action: z.enum(['submit', 'get', 'delete', 'list']),
  mediaId: z.string().optional(),
  publishId: z.string().optional(),
  offset: z.number().optional(),
  count: z.number().optional(),
});

/**
 * 发布工具处理器
 */
async function handlePublishTool(context: WechatToolContext): Promise<WechatToolResult> {
  const { args, apiClient } = context;
  
  try {
    const validatedArgs = publishToolSchema.parse(args);
    const { action } = validatedArgs;

    switch (action) {
      case 'submit': {
        const { mediaId } = validatedArgs;
        
        if (!mediaId) {
          throw new Error('草稿ID不能为空');
        }
        
        try {
          const result = await apiClient.post('/cgi-bin/freepublish/submit', {
            media_id: mediaId
          }) as any;
          
          return {
            content: [{
              type: 'text',
              text: `发布提交成功！\n发布ID: ${result.publish_id}\n草稿ID: ${mediaId}\n\n注意：发布结果将通过事件推送通知，请关注推送消息。`,
            }],
          };
        } catch (error) {
          throw new Error(`发布提交失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'get': {
        const { publishId } = validatedArgs;
        
        if (!publishId) {
          throw new Error('发布ID不能为空');
        }
        
        try {
          const result = await apiClient.post('/cgi-bin/freepublish/get', {
            publish_id: publishId
          }) as any;
          
          const statusMap: { [key: number]: string } = {
            0: '成功',
            1: '发布失败',
            2: '发布成功',
            3: '发布中',
            4: '原创失败'
          };
          
          const firstArticle = result.article_detail.item[0];
          const articleCount = result.article_detail.count;
          
          return {
            content: [{
              type: 'text',
              text: `发布状态查询成功！\n` +
                    `发布ID: ${publishId}\n` +
                    `发布状态: ${statusMap[result.publish_status] || '未知状态'}\n` +
                    `文章数量: ${articleCount}\n` +
                    `首篇标题: ${firstArticle.title}\n` +
                    `作者: ${firstArticle.author || '未设置'}\n` +
                    `文章链接: ${firstArticle.url || '暂无'}\n` +
                    `发布时间: ${result.article_detail.create_time ? new Date(result.article_detail.create_time * 1000).toLocaleString() : '未发布'}`,
            }],
          };
        } catch (error) {
          throw new Error(`查询发布状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'delete': {
        const { publishId: deletePublishId } = validatedArgs;
        
        if (!deletePublishId) {
          throw new Error('发布ID不能为空');
        }
        
        try {
          await apiClient.post('/cgi-bin/freepublish/delete', {
            publish_id: deletePublishId
          }) as any;
          
          return {
            content: [{
              type: 'text',
              text: `发布删除成功！\n发布ID: ${deletePublishId}\n\n注意：删除发布不会删除草稿，如需删除草稿请使用草稿管理工具。`,
            }],
          };
        } catch (error) {
          throw new Error(`删除发布失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'list': {
        const { offset = 0, count = 20 } = validatedArgs;
        
        try {
          const result = await apiClient.post('/cgi-bin/freepublish/batchget', {
            offset,
            count
          }) as any;
          
          const statusMap: { [key: number]: string } = {
            0: '成功',
            1: '发布失败',
            2: '发布成功',
            3: '发布中',
            4: '原创失败'
          };
          
          const publishList = result.item.map((item: any, index: number) => {
            const firstArticle = item.article_detail.item[0];
            const articleCount = item.article_detail.count;
            
            return `${offset + index + 1}. 发布ID: ${item.publish_id}\n` +
                   `   状态: ${statusMap[item.publish_status] || '未知状态'}\n` +
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
        } catch (error) {
          throw new Error(`获取发布列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logger.error('Publish tool error:', error);
    return {
      content: [{
        type: 'text',
        text: `发布操作失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }],
      isError: true,
    };
  }
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
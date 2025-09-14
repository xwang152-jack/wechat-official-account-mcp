import { z } from 'zod';
import { WechatToolDefinition, WechatToolContext, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// 永久素材工具参数 Schema
const permanentMediaToolSchema = z.object({
  action: z.enum(['add', 'get', 'delete', 'list', 'count']),
  type: z.enum(['image', 'voice', 'video', 'thumb', 'news']).optional(),
  mediaId: z.string().optional(),
  filePath: z.string().optional(),
  fileData: z.string().optional(),
  fileName: z.string().optional(),
  title: z.string().optional(),
  introduction: z.string().optional(),
  offset: z.number().optional(),
  count: z.number().optional(),
});

/**
 * 永久素材工具处理器
 */
async function handlePermanentMediaTool(context: WechatToolContext): Promise<WechatToolResult> {
  const { args, apiClient } = context;
  
  try {
    const validatedArgs = permanentMediaToolSchema.parse(args);
    const { action } = validatedArgs;

    switch (action) {
      case 'add':
        const { type, filePath, fileData, fileName, title, introduction } = validatedArgs;
        
        if (!type) {
          throw new Error('素材类型不能为空');
        }
        
        if (!fileData && !filePath) {
          throw new Error('文件数据或文件路径不能为空');
        }
        
        // 准备文件数据
        let mediaBuffer: Buffer;
        let actualFileName: string;
        
        if (fileData) {
          // 如果提供了base64数据
          mediaBuffer = Buffer.from(fileData, 'base64');
          actualFileName = fileName || `media.${type === 'image' ? 'jpg' : type === 'voice' ? 'mp3' : type === 'video' ? 'mp4' : 'jpg'}`;
        } else if (filePath) {
          // 如果提供了文件路径
          const fs = await import('fs');
          mediaBuffer = fs.readFileSync(filePath);
          actualFileName = fileName || filePath.split('/').pop() || 'media';
        } else {
          throw new Error('无效的文件数据');
        }
        
        try {
          const result = await apiClient.post(
            `/cgi-bin/material/add_material?type=${type}`,
            (() => {
              const FormData = require('form-data');
              const formData = new FormData();
              formData.append('media', mediaBuffer, actualFileName);
              
              // 视频素材需要描述信息
              if (type === 'video' && (title || introduction)) {
                const description = {
                  title: title || '视频标题',
                  introduction: introduction || '视频简介'
                };
                formData.append('description', JSON.stringify(description));
              }
              
              return formData;
            })()
          );
          
          return {
            content: [{
              type: 'text',
              text: `永久素材上传成功！\n素材ID: ${result.media_id}${result.url ? `\n素材URL: ${result.url}` : ''}`,
            }],
          };
        } catch (error) {
          throw new Error(`上传永久素材失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      
      case 'get':
        const { mediaId } = validatedArgs;
        
        if (!mediaId) {
          throw new Error('素材ID不能为空');
        }
        
        try {
          const result = await apiClient.post('/cgi-bin/material/get_material', {
            media_id: mediaId
          });
          
          // 如果是图文素材，返回详细信息
          if (result.news_item) {
            const articles = result.news_item.map((item: any, index: number) => 
              `第${index + 1}篇:\n` +
              `标题: ${item.title}\n` +
              `作者: ${item.author || '未设置'}\n` +
              `摘要: ${item.digest || '无'}\n` +
              `链接: ${item.url}\n` +
              `封面图: ${item.thumb_url}\n`
            ).join('\n');
            
            return {
              content: [{
                type: 'text',
                text: `获取永久图文素材成功！\n\n${articles}`,
              }],
            };
          }
          
          // 如果是其他类型素材，返回基本信息
          return {
            content: [{
              type: 'text',
              text: `获取永久素材成功！\n素材ID: ${mediaId}\n创建时间: ${new Date(result.create_time * 1000).toLocaleString()}${result.url ? `\n素材URL: ${result.url}` : ''}`,
            }],
          };
        } catch (error) {
          throw new Error(`获取永久素材失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      
      case 'delete':
        const { mediaId: deleteMediaId } = validatedArgs;
        
        if (!deleteMediaId) {
          throw new Error('素材ID不能为空');
        }
        
        try {
          await apiClient.post('/cgi-bin/material/del_material', {
            media_id: deleteMediaId
          });
          
          return {
            content: [{
              type: 'text',
              text: `永久素材删除成功！\n素材ID: ${deleteMediaId}`,
            }],
          };
        } catch (error) {
          throw new Error(`删除永久素材失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      
      case 'list':
        const { type: listType, offset = 0, count = 20 } = validatedArgs;
        
        if (!listType) {
          throw new Error('素材类型不能为空');
        }
        
        try {
          const result = await apiClient.post('/cgi-bin/material/batchget_material', {
            type: listType,
            offset,
            count
          });
          
          if (listType === 'news') {
            // 图文素材列表
            const newsList = result.item.map((item: any, index: number) => {
              const articles = item.content.news_item.map((article: any, articleIndex: number) => 
                `  第${articleIndex + 1}篇: ${article.title}`
              ).join('\n');
              
              return `${offset + index + 1}. 素材ID: ${item.media_id}\n` +
                     `   更新时间: ${new Date(item.update_time * 1000).toLocaleString()}\n` +
                     `   文章列表:\n${articles}`;
            }).join('\n\n');
            
            return {
              content: [{
                type: 'text',
                text: `永久图文素材列表 (${offset + 1}-${offset + result.item.length}/${result.total_count}):\n\n${newsList}`,
              }],
            };
          } else {
            // 其他类型素材列表
            const mediaList = result.item.map((item: any, index: number) => 
              `${offset + index + 1}. 素材ID: ${item.media_id}\n` +
              `   文件名: ${item.name}\n` +
              `   更新时间: ${new Date(item.update_time * 1000).toLocaleString()}${item.url ? `\n   URL: ${item.url}` : ''}`
            ).join('\n\n');
            
            return {
              content: [{
                type: 'text',
                text: `永久${listType}素材列表 (${offset + 1}-${offset + result.item.length}/${result.total_count}):\n\n${mediaList}`,
              }],
            };
          }
        } catch (error) {
          throw new Error(`获取永久素材列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      
      case 'count':
        try {
          const result = await apiClient.get('/cgi-bin/material/get_materialcount');
          
          return {
            content: [{
              type: 'text',
              text: `永久素材统计信息：\n` +
                    `图片素材: ${result.image_count} 个\n` +
                    `语音素材: ${result.voice_count} 个\n` +
                    `视频素材: ${result.video_count} 个\n` +
                    `图文素材: ${result.news_count} 个`,
            }],
          };
        } catch (error) {
          throw new Error(`获取永久素材统计失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logger.error('Permanent media tool error:', error);
    return {
      content: [{
        type: 'text',
        text: `永久素材操作失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }],
      isError: true,
    };
  }
}

/**
 * 微信公众号永久素材工具
 */
export const permanentMediaTool: WechatToolDefinition = {
  name: 'wechat_permanent_media',
  description: '管理微信公众号永久素材',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'get', 'delete', 'list', 'count'],
        description: '操作类型',
      },
      type: {
        type: 'string',
        enum: ['image', 'voice', 'video', 'thumb', 'news'],
        description: '素材类型',
      },
      mediaId: {
        type: 'string',
        description: '素材 ID',
      },
    },
    required: ['action'],
  },
  handler: handlePermanentMediaTool,
};
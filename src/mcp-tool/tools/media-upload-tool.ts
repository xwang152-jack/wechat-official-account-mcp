import { z } from 'zod';
import { WechatToolDefinition, WechatToolContext, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// 素材上传工具参数 Schema
const mediaUploadToolSchema = z.object({
  action: z.enum(['upload', 'get', 'list']),
  type: z.enum(['image', 'voice', 'video', 'thumb']).optional(),
  filePath: z.string().optional(),
  fileData: z.string().optional(), // base64 编码的文件数据
  fileName: z.string().optional(),
  mediaId: z.string().optional(),
  title: z.string().optional(), // 视频素材的标题
  introduction: z.string().optional(), // 视频素材的描述
});

/**
 * 素材上传工具处理器
 */
async function handleMediaUploadTool(context: WechatToolContext): Promise<WechatToolResult> {
  const { args, apiClient } = context;
  
  try {
    const validatedArgs = mediaUploadToolSchema.parse(args);
    const { action, type, filePath, fileData, fileName, mediaId, title, introduction } = validatedArgs;

    switch (action) {
      case 'upload': {
        if (!type) {
          throw new Error('Media type is required for upload');
        }
        
        if (!filePath && !fileData) {
          throw new Error('Either filePath or fileData is required for upload');
        }
        
        let uploadData: Buffer;
        let uploadFileName: string;
        
        if (fileData) {
          // 从 base64 数据上传
          uploadData = Buffer.from(fileData, 'base64');
          uploadFileName = fileName || `media.${type === 'image' ? 'jpg' : type === 'voice' ? 'mp3' : type === 'video' ? 'mp4' : 'jpg'}`;
        } else {
          // 从文件路径上传
          const fs = await import('fs/promises');
          uploadData = await fs.readFile(filePath!);
          uploadFileName = fileName || filePath!.split('/').pop() || 'media';
        }
        
        const result = await apiClient.uploadMedia({
          type,
          media: uploadData,
          fileName: uploadFileName,
          title,
          introduction,
        });
        
        // TODO: 保存素材信息到本地存储（暂未实现）
        // await storageManager.saveMedia({
        //   mediaId: result.mediaId,
        //   type,
        //   createdAt: Date.now(),
        //   url: result.url,
        // });
        
        return {
          content: [{
            type: 'text',
            text: `素材上传成功:\n- Media ID: ${result.mediaId}\n- 类型: ${type}\n- 文件名: ${uploadFileName}\n- 创建时间: ${new Date().toLocaleString()}${result.url ? `\n- URL: ${result.url}` : ''}`,
          }],
        };
      }
      
      case 'get': {
        if (!mediaId) {
          throw new Error('Media ID is required for get operation');
        }
        
        // TODO: 从本地存储获取素材信息（暂未实现）
        return {
          content: [{
            type: 'text',
            text: `获取素材信息功能正在开发中，Media ID: ${mediaId}`,
          }],
        };
      }
      
      case 'list': {
        // TODO: 从本地存储列出素材（暂未实现）
        return {
          content: [{
            type: 'text',
            text: `素材列表功能正在开发中${type ? `，类型: ${type}` : ''}`,
          }],
        };
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logger.error('Media upload tool error:', error);
    return {
      content: [{
        type: 'text',
        text: `素材操作失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }],
      isError: true,
    };
  }
}

/**
 * 微信公众号素材上传工具
 */
export const mediaUploadTool: WechatToolDefinition = {
  name: 'wechat_media_upload',
  description: '上传和管理微信公众号临时素材（图片、语音、视频、缩略图）',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['upload', 'get', 'list'],
        description: '操作类型：upload(上传), get(获取), list(列表)',
      },
      type: {
        type: 'string',
        enum: ['image', 'voice', 'video', 'thumb'],
        description: '素材类型：image(图片), voice(语音), video(视频), thumb(缩略图)',
      },
      filePath: {
        type: 'string',
        description: '本地文件路径',
      },
      fileData: {
        type: 'string',
        description: 'Base64 编码的文件数据',
      },
      fileName: {
        type: 'string',
        description: '文件名（可选）',
      },
      mediaId: {
        type: 'string',
        description: '素材 ID（获取素材信息时必需）',
      },
      title: {
        type: 'string',
        description: '视频素材的标题（仅视频类型需要）',
      },
      introduction: {
        type: 'string',
        description: '视频素材的描述（仅视频类型需要）',
      },
    },
    required: ['action'],
  },
  handler: handleMediaUploadTool,
};
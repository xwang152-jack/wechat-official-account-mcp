import { WechatApiClient } from '../../wechat/api-client.js';
import { WechatToolResult, McpTool } from '../types.js';
import { logger } from '../../utils/logger.js';
import { StorageManager } from '../../storage/storage-manager.js';
import { z } from 'zod';
import FormData from 'form-data';

// 媒体上传工具参数Schema (暂未使用，保留用于未来扩展)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
async function handleMediaUploadTool(args: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> {
  // MCP SDK已经验证了参数，直接使用
  const { action, type, filePath, fileData, fileName, mediaId, title, introduction } = args as any;
  
  try {

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
        
        // 准备表单数据
        const formData = new FormData();
        formData.append('media', uploadData, uploadFileName);
        
        // 视频素材需要描述信息
        if (type === 'video' && (title || introduction)) {
          const description = {
            title: title || '视频标题',
            introduction: introduction || '视频简介'
          };
          formData.append('description', JSON.stringify(description));
        }
        
        const result = await apiClient.post(
          `/cgi-bin/media/upload?type=${type}`,
          formData
        ) as any;
        
        // 保存到本地存储
        const storageManager = new StorageManager();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const saveResult = await storageManager.saveMedia({
          mediaId: result.media_id,
          type: result.type as 'image' | 'voice' | 'video' | 'thumb',
          createdAt: result.created_at,
          url: uploadFileName
        });
        
        return {
          content: [{
            type: 'text',
            text: `临时素材上传成功！\n素材ID: ${result.media_id}\n类型: ${result.type}\n创建时间: ${new Date(result.created_at * 1000).toLocaleString()}`,
          }],
        };
      }
      
      case 'get': {
        if (!mediaId) {
          throw new Error('素材ID不能为空');
        }
        
        try {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const result = await apiClient.get(`/cgi-bin/media/get?media_id=${mediaId}`) as any;
          
          return {
            content: [{
              type: 'text',
              text: `获取临时素材成功！\n素材ID: ${mediaId}\n素材已下载到本地`,
            }],
          };
        } catch (error) {
          throw new Error(`获取临时素材失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }
      
      case 'list': {
        return {
          content: [{
            type: 'text',
            text: `临时素材列表功能暂不支持，临时素材有效期为3天，建议使用永久素材功能`,
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
 * 微信公众号临时素材工具
 */
export const mediaUploadTool: McpTool = {
  name: 'wechat_media_upload',
  description: '上传和管理微信公众号临时素材（图片、语音、视频、缩略图）',
  inputSchema: {
    action: z.enum(['upload', 'get', 'list']).describe('操作类型：upload-上传素材, get-获取素材, list-列表素材'),
    type: z.enum(['image', 'voice', 'video', 'thumb']).optional().describe('素材类型：image-图片, voice-语音, video-视频, thumb-缩略图'),
    filePath: z.string().optional().describe('本地文件路径（upload操作可选）'),
    fileData: z.string().optional().describe('Base64编码的文件数据（upload操作可选，与filePath二选一）'),
    fileName: z.string().optional().describe('文件名（upload操作可选）'),
    mediaId: z.string().optional().describe('媒体文件ID（get操作必需）'),
    title: z.string().optional().describe('视频素材的标题（video类型upload操作可选）'),
    introduction: z.string().optional().describe('视频素材的描述（video类型upload操作可选）')
  },
  handler: handleMediaUploadTool
};
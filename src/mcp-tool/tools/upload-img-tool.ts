import { z } from 'zod';
import { WechatToolDefinition, WechatToolContext, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// 上传图文消息图片工具参数 Schema
const uploadImgToolSchema = z.object({
  filePath: z.string().optional(),
  fileData: z.string().optional(), // base64 编码的文件数据
  fileName: z.string().optional(),
});

/**
 * 上传图文消息图片工具处理器
 */
async function handleUploadImgTool(context: WechatToolContext): Promise<WechatToolResult> {
  const { args, apiClient } = context;
  
  try {
    const validatedArgs = uploadImgToolSchema.parse(args);
    const { filePath, fileData, fileName } = validatedArgs;

    if (!filePath && !fileData) {
      throw new Error('Either filePath or fileData is required');
    }

    let fileBuffer: Buffer;
    let actualFileName: string;

    if (filePath) {
      // 从文件路径读取
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      fileBuffer = fs.readFileSync(filePath);
      actualFileName = fileName || path.basename(filePath);
    } else if (fileData) {
      // 从 base64 数据读取
      fileBuffer = Buffer.from(fileData, 'base64');
      actualFileName = fileName || 'image.jpg';
    } else {
      throw new Error('No file data provided');
    }

    // 检查文件大小（1MB限制）
    if (fileBuffer.length > 1024 * 1024) {
      throw new Error('File size must be less than 1MB');
    }

    // 检查文件格式
    const ext = path.extname(actualFileName).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      throw new Error('Only jpg/png formats are supported');
    }

    // 准备表单数据
    const formData = new FormData();
    formData.append('media', fileBuffer, {
      filename: actualFileName,
      contentType: ext === '.png' ? 'image/png' : 'image/jpeg'
    });

    // 调用微信API
    const response = await apiClient.uploadImg(formData);
    
    if (response.errcode && response.errcode !== 0) {
      throw new Error(`WeChat API error: ${response.errmsg} (${response.errcode})`);
    }

    logger.info('Image uploaded successfully', {
      url: response.url,
      fileName: actualFileName,
      size: fileBuffer.length
    });

    return {
      content: [{
        type: 'text',
        text: `Image uploaded successfully\nURL: ${response.url}\nFile: ${actualFileName}\nSize: ${fileBuffer.length} bytes\nFormat: ${ext.substring(1)}`
      }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to upload image', { error: errorMessage });
    
    return {
      content: [{
        type: 'text',
        text: `Failed to upload image: ${errorMessage}`
      }],
      isError: true
    };
  }
}

/**
 * 微信公众号上传图文消息图片工具
 */
export const uploadImgTool: WechatToolDefinition = {
  name: 'wechat_upload_img',
  description: '上传图文消息内所需的图片，不占用素材库限制',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: '图片文件路径（与fileData二选一）',
      },
      fileData: {
        type: 'string',
        description: 'base64编码的图片数据（与filePath二选一）',
      },
      fileName: {
        type: 'string',
        description: '文件名（可选，默认从路径提取或使用image.jpg）',
      },
    },
    required: []
  },
  handler: handleUploadImgTool,
};
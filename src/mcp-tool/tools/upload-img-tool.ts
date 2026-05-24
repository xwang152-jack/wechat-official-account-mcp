import { z } from 'zod';
import { WechatToolResult, McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';
import FormData from 'form-data';
import path from 'path';
import { validateFilePath } from '../../utils/validation.js';

// 上传图文消息图片参数 Schema
const uploadImgToolSchema = z.object({
  filePath: z.string().optional(),
  fileData: z.string().optional(),
  fileName: z.string().optional(),
});

/**
 * 上传图文消息图片工具处理器
 */
async function handleUploadImgTool(args: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> {
  const { filePath, fileData, fileName } = uploadImgToolSchema.parse(args);

  if (!filePath && !fileData) {
    throw new Error('文件路径或文件数据不能为空');
  }

  let fileBuffer: Buffer;
  let actualFileName: string;

  if (filePath) {
    // 从文件路径读取（异步）
    const resolvedPath = validateFilePath(filePath);
    const { readFile } = await import('fs/promises');
    fileBuffer = await readFile(resolvedPath);
    actualFileName = fileName || path.basename(resolvedPath);
  } else if (fileData) {
    // 从 base64 数据读取
    fileBuffer = Buffer.from(fileData, 'base64');
    actualFileName = fileName || 'image.jpg';
  } else {
    throw new Error('未提供文件数据');
  }

  // 检查文件大小（1MB限制）
  if (fileBuffer.length > 1024 * 1024) {
    throw new Error('文件大小不能超过1MB');
  }

  // 检查文件格式
  const ext = path.extname(actualFileName).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    throw new Error('仅支持jpg/png格式的图片');
  }

  // 准备表单数据
  const formData = new FormData();
  formData.append('media', fileBuffer, {
    filename: actualFileName,
    contentType: ext === '.png' ? 'image/png' : 'image/jpeg'
  });

  // 调用微信API
  const response = await apiClient.post('/cgi-bin/media/uploadimg', formData) as any;

  if (response.errcode && response.errcode !== 0) {
    throw new Error(`微信API错误: ${response.errmsg} (${response.errcode})`);
  }

  return {
    content: [{
      type: 'text',
      text: `图片上传成功！\n图片URL: ${response.url}\n文件名: ${actualFileName}\n文件大小: ${fileBuffer.length} 字节\n格式: ${ext.substring(1)}`
    }]
  };
}

/**
 * 微信公众号上传图文消息图片工具
 */
export const uploadImgTool: McpTool = {
  name: 'wechat_upload_img',
  description: '上传图文消息内所需的图片，不占用素材库限制',
  inputSchema: {
    filePath: z.string().optional().describe('图片文件路径（与fileData二选一）'),
    fileData: z.string().optional().describe('base64编码的图片数据（与filePath二选一）'),
    fileName: z.string().optional().describe('文件名（可选，默认从路径提取或使用image.jpg）')
  },
  handler: handleUploadImgTool
};

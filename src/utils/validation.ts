import { z } from 'zod';

/**
 * 文件类型白名单
 */
export const ALLOWED_MEDIA_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'audio/mp3',
  'audio/mpeg',
  'audio/amr',
  'video/mp4',
] as const;

/**
 * 文件大小限制 (字节)
 */
export const FILE_SIZE_LIMITS = {
  image: 2 * 1024 * 1024, // 2MB
  voice: 2 * 1024 * 1024, // 2MB
  video: 10 * 1024 * 1024, // 10MB
  thumb: 64 * 1024, // 64KB
} as const;

/**
 * URL 验证正则
 */
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

/**
 * 危险的 HTML 标签和属性列表
 */
const DANGEROUS_HTML_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gis,
  /<iframe[^>]*>.*?<\/iframe>/gis,
  /javascript:/gi,
  /on\w+\s*=/gi, // 事件处理器如 onclick, onerror
  /<embed[^>]*>/gi,
  /<object[^>]*>.*?<\/object>/gis,
];

/**
 * 检查 HTML 内容是否包含危险代码
 */
export function sanitizeHtmlContent(content: string): string {
  let sanitized = content;

  // 移除危险的 HTML 标签和属性
  DANGEROUS_HTML_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized;
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') {
    return false;
  }
  return URL_REGEX.test(url);
}

/**
 * 验证文件类型
 */
export function isValidMediaType(mimeType: string): boolean {
  return ALLOWED_MEDIA_TYPES.includes(mimeType as any);
}

/**
 * 验证文件大小
 */
export function isValidFileSize(size: number, type: 'image' | 'voice' | 'video' | 'thumb'): boolean {
  return size <= FILE_SIZE_LIMITS[type];
}

/**
 * 文章标题验证 - 限制长度和特殊字符
 */
export const articleTitleSchema = z.string()
  .min(1, '标题不能为空')
  .max(64, '标题不能超过64个字符')
  .transform(val => val.trim());

/**
 * 文章内容验证 - 检测和清理危险HTML
 */
export const articleContentSchema = z.string()
  .min(1, '内容不能为空')
  .max(200000, '内容不能超过200000字符') // 微信限制
  .transform(val => sanitizeHtmlContent(val));

/**
 * URL 验证 Schema
 */
export const urlSchema = z.string()
  .optional()
  .refine(val => !val || isValidUrl(val), 'URL格式不正确');

/**
 * Media ID 验证
 */
export const mediaIdSchema = z.string()
  .min(1, 'Media ID不能为空')
  .max(128, 'Media ID长度不正确');

/**
 * 草稿文章验证 Schema (增强版)
 */
export const draftArticleSchema = z.object({
  title: articleTitleSchema,
  author: z.string().max(32, '作者名不能超过32个字符').optional(),
  digest: z.string().max(256, '摘要不能超过256个字符').optional(),
  content: articleContentSchema,
  contentSourceUrl: urlSchema,
  thumbMediaId: mediaIdSchema,
  showCoverPic: z.number().int().min(0).max(1).optional(),
  needOpenComment: z.number().int().min(0).max(1).optional(),
  onlyFansCanComment: z.number().int().min(0).max(1).optional(),
});

/**
 * 文件上传验证 Schema
 */
export const fileUploadSchema = z.object({
  type: z.enum(['image', 'voice', 'video', 'thumb']),
  fileType: z.string().refine(val => isValidMediaType(val), '不支持的文件类型'),
  fileSize: z.number().positive('文件大小必须大于0'),
});

/**
 * App ID 验证
 */
export const appIdSchema = z.string()
  .min(1, 'App ID不能为空')
  .max(32, 'App ID长度不正确')
  .regex(/^wx[a-z0-9]{16}$/i, 'App ID格式不正确,应为wx开头的18位字符');

/**
 * App Secret 验证
 */
export const appSecretSchema = z.string()
  .min(1, 'App Secret不能为空')
  .max(64, 'App Secret长度不正确')
  .regex(/^[a-f0-9]{32}$/i, 'App Secret格式不正确,应为32位十六进制字符');

import { z } from 'zod';
import { WechatToolResult, McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';
import FormData from 'form-data';
import { validateFilePath, draftArticleSchema } from '../../utils/validation.js';

// 永久素材工具参数Schema
const permanentMediaToolSchema = z.object({
  action: z.enum(['add', 'update', 'get', 'delete', 'list', 'count']),
  type: z.enum(['image', 'voice', 'video', 'thumb', 'news']).optional(),
  mediaId: z.string().optional(),
  index: z.number().int().min(0).optional(),
  filePath: z.string().optional(),
  fileData: z.string().optional(),
  fileName: z.string().optional(),
  title: z.string().optional(),
  introduction: z.string().optional(),
  articles: z.array(draftArticleSchema).optional(),
  offset: z.number().optional(),
  count: z.number().optional(),
});

function formatNewsArticle(article: any) {
  return {
    title: article.title,
    author: article.author || '',
    digest: article.digest || '',
    content: article.content,
    content_source_url: article.contentSourceUrl || '',
    thumb_media_id: article.thumbMediaId,
    show_cover_pic: article.showCoverPic || 0,
    need_open_comment: article.needOpenComment || 0,
    only_fans_can_comment: article.onlyFansCanComment || 0,
  };
}

/**
 * 永久素材工具处理器
 */
async function handlePermanentMediaTool(args: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> {
  const validated = permanentMediaToolSchema.parse(args);
  const { action } = validated;

  switch (action) {
    case 'add': {
      const { type, filePath, fileData, fileName, title, introduction, articles } = validated;

      if (!type) {
        throw new Error('素材类型不能为空');
      }

      if (type === 'news') {
        if (!articles || articles.length === 0) {
          throw new Error('上传永久图文素材时 articles 不能为空');
        }

        const result = await apiClient.addNews(articles.map((article) => formatNewsArticle(article)) as any);

        return {
          content: [{
            type: 'text',
            text: `永久图文素材创建成功！\n素材ID: ${result.mediaId}\n文章数: ${articles.length}`,
          }],
        };
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
        // 如果提供了文件路径（异步读取）
        const resolvedPath = validateFilePath(filePath);
        const { readFile } = await import('fs/promises');
        mediaBuffer = await readFile(resolvedPath);
        actualFileName = fileName || resolvedPath.split('/').pop() || 'media';
      } else {
        throw new Error('无效的文件数据');
      }

      const result = await apiClient.post(
        `/cgi-bin/material/add_material?type=${type}`,
        (() => {
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
      ) as any;

      return {
        content: [{
          type: 'text',
          text: `永久素材上传成功！\n素材ID: ${result.media_id}${result.url ? `\n素材URL: ${result.url}` : ''}`,
        }],
      };
    }

    case 'update': {
      const { mediaId, index, articles } = validated;

      if (!mediaId) {
        throw new Error('素材ID不能为空');
      }

      if (index === undefined) {
        throw new Error('更新永久图文素材时必须提供文章索引 index');
      }

      if (!articles || articles.length !== 1) {
        throw new Error('更新永久图文素材时必须提供且仅提供一篇文章内容');
      }

      await apiClient.post('/cgi-bin/material/update_news', {
        media_id: mediaId,
        index,
        articles: formatNewsArticle(articles[0]),
      }) as any;

      return {
        content: [{
          type: 'text',
          text: `永久图文素材更新成功！\n素材ID: ${mediaId}\n更新索引: ${index}`,
        }],
      };
    }

    case 'get': {
      const { mediaId } = validated;

      if (!mediaId) {
        throw new Error('素材ID不能为空');
      }

      const result = await apiClient.post('/cgi-bin/material/get_material', {
        media_id: mediaId
      }) as any;

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
    }

    case 'delete': {
      const { mediaId: deleteMediaId } = validated;

      if (!deleteMediaId) {
        throw new Error('素材ID不能为空');
      }

      await apiClient.post('/cgi-bin/material/del_material', {
        media_id: deleteMediaId
      }) as any;

      return {
        content: [{
          type: 'text',
          text: `永久素材删除成功！\n素材ID: ${deleteMediaId}`,
        }],
      };
    }

    case 'list': {
      const { type: listType, offset = 0, count = 20 } = validated;

      if (!listType) {
        throw new Error('素材类型不能为空');
      }

      const result = await apiClient.post('/cgi-bin/material/batchget_material', {
        type: listType,
        offset,
        count
      }) as any;

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
    }

    case 'count': {
      const result = await apiClient.get('/cgi-bin/material/get_materialcount') as any;

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
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * 微信公众号永久素材工具
 */
export const permanentMediaTool: McpTool = {
  name: 'wechat_permanent_media',
  description: '管理微信公众号永久素材，支持添加、更新、获取、删除、列表和统计操作',
  inputSchema: {
    action: z.enum(['add', 'update', 'get', 'delete', 'list', 'count']).describe('操作类型：add-添加素材, update-更新永久图文素材, get-获取素材, delete-删除素材, list-获取素材列表, count-获取素材总数'),
    type: z.enum(['image', 'voice', 'video', 'thumb', 'news']).optional().describe('素材类型：image-图片, voice-语音, video-视频, thumb-缩略图, news-图文素材'),
    mediaId: z.string().optional().describe('媒体文件ID（get、update 和 delete 操作必需）'),
    index: z.number().int().min(0).optional().describe('图文文章索引（update 操作必需）'),
    filePath: z.string().optional().describe('本地文件路径（非 news 类型 add 操作必需）'),
    fileData: z.string().optional().describe('Base64编码的文件数据（非 news 类型 add 操作可选，与filePath二选一）'),
    fileName: z.string().optional().describe('文件名（非 news 类型 add 操作可选）'),
    title: z.string().optional().describe('视频素材的标题（video 类型 add 操作必需）'),
    introduction: z.string().optional().describe('视频素材的描述（video 类型 add 操作必需）'),
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
    })).optional().describe('图文文章列表（news 类型 add 时可传多篇，update 时必须且仅能传一篇）'),
    offset: z.number().optional().describe('从全部素材中的该偏移位置开始返回（list操作可选，默认0）'),
    count: z.number().optional().describe('返回素材的数量（list操作可选，默认20，最大20）')
  },
  handler: handlePermanentMediaTool
};

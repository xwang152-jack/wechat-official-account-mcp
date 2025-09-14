import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { AuthManager } from '../auth/auth-manager.js';
import { logger } from '../utils/logger.js';

/**
 * 微信公众号 API 客户端
 * 封装微信公众号 API 调用
 */
export class WechatApiClient {
  private authManager: AuthManager;
  private httpClient: AxiosInstance;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.httpClient = axios.create({
      baseURL: 'https://api.weixin.qq.com',
      timeout: 30000,
    });

    // 请求拦截器：自动添加 access_token
    this.httpClient.interceptors.request.use(async (config) => {
      if (config.url && !config.url.includes('access_token=')) {
        const tokenInfo = await this.authManager.getAccessToken();
        const separator = config.url.includes('?') ? '&' : '?';
        config.url += `${separator}access_token=${tokenInfo.accessToken}`;
      }
      return config;
    });

    // 响应拦截器：处理错误
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Wechat API request failed:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * 上传临时素材
   */
  async uploadMedia(params: {
    type: 'image' | 'voice' | 'video' | 'thumb';
    media: Buffer;
    fileName: string;
    title?: string;
    introduction?: string;
  }): Promise<{ mediaId: string; type: string; createdAt: number; url?: string }> {
    try {
      const formData = new FormData();
      formData.append('media', params.media, params.fileName);
      
      if (params.type === 'video') {
        const description = {
          title: params.title || 'Video',
          introduction: params.introduction || '',
        };
        formData.append('description', JSON.stringify(description));
      }

      const response = await this.httpClient.post(
        `/cgi-bin/media/upload?type=${params.type}`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

      if (response.data.errcode) {
        throw new Error(`Upload failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        mediaId: response.data.media_id,
        type: response.data.type,
        createdAt: response.data.created_at * 1000,
        url: response.data.url,
      };
    } catch (error) {
      logger.error('Failed to upload media:', error);
      throw error;
    }
  }

  /**
   * 获取临时素材
   */
  async getMedia(mediaId: string): Promise<Buffer> {
    try {
      const response = await this.httpClient.get(
        `/cgi-bin/media/get?media_id=${mediaId}`,
        {
          responseType: 'arraybuffer',
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to get media:', error);
      throw error;
    }
  }

  /**
   * 新增永久图文素材
   */
  async addNews(articles: Array<{
    title: string;
    author?: string;
    digest?: string;
    content: string;
    contentSourceUrl?: string;
    thumbMediaId: string;
    showCoverPic?: number;
    needOpenComment?: number;
    onlyFansCanComment?: number;
  }>): Promise<{ mediaId: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/material/add_news', {
        articles,
      });

      if (response.data.errcode) {
        throw new Error(`Add news failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        mediaId: response.data.media_id,
      };
    } catch (error) {
      logger.error('Failed to add news:', error);
      throw error;
    }
  }

  /**
   * 新增草稿
   */
  async addDraft(articles: Array<{
    title: string;
    author?: string;
    digest?: string;
    content: string;
    contentSourceUrl?: string;
    thumbMediaId: string;
    showCoverPic?: number;
    needOpenComment?: number;
    onlyFansCanComment?: number;
  }>): Promise<{ mediaId: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/draft/add', {
        articles,
      });

      if (response.data.errcode) {
        throw new Error(`Add draft failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        mediaId: response.data.media_id,
      };
    } catch (error) {
      logger.error('Failed to add draft:', error);
      throw error;
    }
  }

  /**
   * 发布接口
   */
  async publishDraft(mediaId: string): Promise<{ publishId: string; msgDataId: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/freepublish/submit', {
        media_id: mediaId,
      });

      if (response.data.errcode) {
        throw new Error(`Publish failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        publishId: response.data.publish_id,
        msgDataId: response.data.msg_data_id,
      };
    } catch (error) {
      logger.error('Failed to publish draft:', error);
      throw error;
    }
  }

  /**
   * 上传图文消息图片
   */
  async uploadImg(formData: FormData): Promise<{ url: string; errcode?: number; errmsg?: string }> {
    try {
      const response = await this.httpClient.post(
        '/cgi-bin/media/uploadimg',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to upload image:', error);
      throw error;
    }
  }

  /**
   * 通用 GET 请求
   */
  async get(path: string, params?: Record<string, any>): Promise<any> {
    try {
      const response = await this.httpClient.get(path, { params });
      
      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`API Error: ${response.data.errmsg} (${response.data.errcode})`);
      }
      
      return response.data;
    } catch (error) {
      logger.error(`GET ${path} failed:`, error);
      throw error;
    }
  }

  /**
   * 通用 POST 请求
   */
  async post(path: string, data?: any): Promise<any> {
    try {
      const response = await this.httpClient.post(path, data);
      
      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`API Error: ${response.data.errmsg} (${response.data.errcode})`);
      }
      
      return response.data;
    } catch (error) {
      logger.error(`POST ${path} failed:`, error);
      throw error;
    }
  }
}
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
        const status = error?.response?.status;
        logger.error('Wechat API request failed:', status ? String(status) : error?.message);
        throw error;
      }
    );
  }

  getAuthManager(): AuthManager {
    return this.authManager;
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
      logger.error('Failed to upload media:', (error as any)?.message ?? String(error));
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
      logger.error('Failed to get media:', (error as any)?.message ?? String(error));
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
      logger.error('Failed to add news:', (error as any)?.message ?? String(error));
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
      logger.error('Failed to add draft:', (error as any)?.message ?? String(error));
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
      logger.error('Failed to publish draft:', (error as any)?.message ?? String(error));
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
      logger.error('Failed to upload image:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 通用 GET 请求
   */
  async get(path: string, params?: Record<string, unknown>): Promise<unknown> {
    try {
      const response = await this.httpClient.get(path, { params });
      
      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`API Error: ${response.data.errmsg} (${response.data.errcode})`);
      }
      
      return response.data;
    } catch (error) {
      logger.error(`GET ${path} failed:`, (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 通用 POST 请求
   */
  async post(path: string, data?: unknown): Promise<unknown> {
    try {
      const response = await this.httpClient.post(path, data);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`API Error: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error(`POST ${path} failed:`, (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 用户管理 API ====================

  /**
   * 获取用户列表
   */
  async getUserList(nextOpenId?: string): Promise<{
    total: number;
    count: number;
    data: { openid: string[] };
    nextOpenid: string;
  }> {
    try {
      const params = nextOpenId ? { next_openid: nextOpenId } : {};
      const response = await this.httpClient.get('/cgi-bin/user/get', { params });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get user list failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get user list:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取用户基本信息
   */
  async getUserInfo(openId: string, lang: 'zh_CN' | 'zh_TW' | 'en' = 'zh_CN'): Promise<{
    subscribe: number;
    openid: string;
    nickname: string;
    sex: number;
    language: string;
    city: string;
    province: string;
    country: string;
    headImgUrl: string;
    subscribeTime: number;
    unionId?: string;
    remark?: string;
    groupId?: number;
    tagidList?: number[];
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/user/info', {
        params: { openid: openId, lang }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get user info failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get user info:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 批量获取用户信息
   */
  async batchGetUserInfo(userList: string[], lang: 'zh_CN' | 'zh_TW' | 'en' = 'zh_CN'): Promise<{
    user_info_list: Array<{
      subscribe: number;
      openid: string;
      nickname: string;
      sex: number;
      language: string;
      city: string;
      province: string;
      country: string;
      headImgUrl: string;
      subscribeTime: number;
      unionId?: string;
      remark?: string;
      groupId?: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/user/info/batchget', {
        user_list: userList.map(openid => ({ openid, lang }))
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Batch get user info failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to batch get user info:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 设置用户备注名
   */
  async updateUserRemark(openId: string, remark: string): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/user/info/updateremark', {
        openid: openId,
        remark
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Update user remark failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to update user remark:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取用户增减数据
   */
  async getUserSummary(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      user_source: number;
      new_user: number;
      cancel_user: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getusersummary', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get user summary failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get user summary:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取累计用户数据
   */
  async getUserCumulate(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      cumulate_user: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getusercumulate', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get user cumulate failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get user cumulate:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 标签管理 API ====================

  /**
   * 创建标签
   */
  async createTag(name: string): Promise<{ tag: { id: number; name: string } }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/tags/create', { tag: { name } });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Create tag failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to create tag:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取标签列表
   */
  async getTags(): Promise<{ tags: Array<{ id: number; name: string; count: number }> }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/tags/get');

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get tags failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get tags:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 编辑标签
   */
  async updateTag(tagId: number, name: string): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/tags/update', { tag: { id: tagId, name } });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Update tag failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to update tag:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 删除标签
   */
  async deleteTag(tagId: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/tags/delete', { tag: { id: tagId } });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Delete tag failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to delete tag:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 批量为用户打标签
   */
  async batchTagging(openIdList: string[], tagId: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/tags/members/batchtagging', {
        openid_list: openIdList,
        tagid: tagId
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Batch tagging failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to batch tagging:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 批量为用户取消标签
   */
  async batchUntagging(openIdList: string[], tagId: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/tags/members/batchuntagging', {
        openid_list: openIdList,
        tagid: tagId
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Batch untagging failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to batch untagging:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取标签下用户列表
   */
  async getTagUsers(tagId: string, nextOpenId?: string): Promise<{
    count: number;
    data: { openid: string[] };
    next_openid: string;
  }> {
    try {
      const params: any = { tagid: tagId };
      if (nextOpenId) params.next_openid = nextOpenId;

      const response = await this.httpClient.post('/cgi-bin/user/tag/get', params);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get tag users failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get tag users:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 自定义菜单 API ====================

  /**
   * 创建自定义菜单
   */
  async createMenu(menuData: {
    button: Array<{
      type?: string;
      name: string;
      key?: string;
      url?: string;
      mediaId?: string;
      sub_button?: Array<any>;
    }>;
  }): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/menu/create', menuData);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Create menu failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to create menu:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 查询自定义菜单
   */
  async getMenu(): Promise<{
    menu: {
      button: Array<any>;
    };
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/menu/get');

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get menu failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get menu:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 删除自定义菜单
   */
  async deleteMenu(): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/menu/delete');

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Delete menu failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to delete menu:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 创建个性化菜单
   */
  async addConditionalMenu(menuData: {
    button: Array<any>;
    matchrule: {
      tag_id?: number;
      sex?: string;
      country?: string;
      province?: string;
      city?: string;
      client_platform_type?: number;
      language?: string;
    };
  }): Promise<{ menuid: number; errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/menu/addconditional', menuData);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Add conditional menu failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to add conditional menu:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 删除个性化菜单
   */
  async deleteConditionalMenu(menuId: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/menu/delconditional', { menuid: menuId });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Delete conditional menu failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to delete conditional menu:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取自定义菜单配置
   */
  async getSelfMenuInfo(): Promise<{
    selfmenu_info: {
      button: Array<any>;
    };
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/get_current_selfmenu_info');

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get self menu info failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get self menu info:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 模板消息 API ====================

  /**
   * 发送模板消息
   */
  async sendTemplateMessage(data: {
    touser: string;
    templateId: string;
    url?: string;
    topcolor?: string;
    data: Record<string, { value: string; color?: string }>;
  }): Promise<{ errcode: number; errmsg: string; msgid: number }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/message/template/send', data);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Send template message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to send template message:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取模板列表
   */
  async getAllPrivateTemplates(): Promise<{
    template_list: Array<{
      templateId: string;
      title: string;
      content: string;
      example: string;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/template/get_all_private_template');

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get templates failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get templates:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 删除模板
   */
  async deletePrivateTemplate(templateId: string): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/template/del_private_template', {
        template_id: templateId
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Delete template failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to delete template:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取行业信息
   */
  async getTemplateIndustry(): Promise<{
    primary_industry: { firstClass: string; secondClass: string };
    secondary_industry: { firstClass: string; secondClass: string };
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/template/get_industry');

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get template industry failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get template industry:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 客服消息 API ====================

  /**
   * 发送客服消息
   */
  async sendCustomMessage(data: {
    touser: string;
    msgtype: 'text' | 'image' | 'voice' | 'video' | 'music' | 'news' | 'mpnews' | 'wxcard';
    text?: { content: string };
    image?: { mediaId: string };
    voice?: { mediaId: string };
    video?: { mediaId: string; thumbMediaId: string; title?: string; description?: string };
    music?: { title: string; description: string; musicurl: string; hqmusicurl: string; thumbMediaId?: string };
    news?: { articles: Array<any> };
    mpnews?: { mediaId: string };
    wxcard?: { cardId: string };
  }): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/message/custom/send', data);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Send custom message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to send custom message:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取客服聊天记录
   */
  async getCustomMessageRecords(startTime: number, endTime: number, msgId?: number, number?: number): Promise<{
    records: Array<{
      worker: string;
      openid: string;
      opercode: number;
      time: number;
      text: string;
    }>;
    errmsg: string;
    errcode: number;
  }> {
    try {
      const data: any = {
        starttime: startTime,
        endtime: endTime
      };
      if (msgId !== undefined) data.msgid = msgId;
      if (number !== undefined) data.number = number;

      const response = await this.httpClient.post('/custommsg/get_records', data);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get custom message records failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get custom message records:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 数据统计 API ====================

  /**
   * 获取图文群发每日数据
   */
  async getArticleSummary(beginDate: string, endDate: string): Promise<{
    list: Array<{
      refDate: string;
      intPageReadUser: number;
      intPageReadCount: number;
      oriPageReadUser: number;
      oriPageReadCount: number;
      shareUser: number;
      shareCount: number;
      addToFavUser: number;
      addToFavCount: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getarticlesummary', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get article summary failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get article summary:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取图文群发总数据
   */
  async getArticleTotal(beginDate: string, endDate: string): Promise<{
    list: Array<{
      refDate: string;
      userSource: number;
      readUser: number;
      readCount: number;
      shareUser: number;
      shareCount: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getarticletotal', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get article total failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get article total:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取图文统计数据
   */
  async getUserRead(beginDate: string, endDate: string): Promise<{
    list: Array<{
      refDate: string;
      intPageReadUser: number;
      intPageReadCount: number;
      oriPageReadUser: number;
      oriPageReadCount: number;
      shareUser: number;
      shareCount: number;
      addToFavUser: number;
      addToFavCount: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getuserread', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get user read failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get user read:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取图文分享转发数据
   */
  async getUserShare(beginDate: string, endDate: string): Promise<{
    list: Array<{
      refDate: string;
      sharePage: number;
      shareUser: number;
      shareCount: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getusershare', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get user share failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get user share:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取消息发送概况数据
   */
  async getUpstreamMessage(beginDate: string, endDate: string): Promise<{
    list: Array<{
      refDate: string;
      msgType: number;
      msgUser: number;
      msgCount: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getupstreammsg', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get upstream message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get upstream message:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取接口分析数据
   */
  async getInterfaceSummary(beginDate: string, endDate: string): Promise<{
    list: Array<{
      refDate: string;
      callbackCount: number;
      failCount: number;
      totalTime: number;
      maxTime: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getinterfacesummary', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get interface summary failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get interface summary:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取接口分析分时数据
   */
  async getInterfaceSummaryHour(beginDate: string, endDate: string): Promise<{
    list: Array<{
      refDate: string;
      refHour: number;
      callbackCount: number;
      failCount: number;
      totalTime: number;
      maxTime: number;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getinterfacesummaryhour', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get interface summary hour failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get interface summary hour:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 自动回复 API ====================

  /**
   * 获取自动回复规则
   */
  async getCurrentAutoReplyInfo(): Promise<{
    isAddFriendReply: boolean;
    isAutoReply: boolean;
    addFriendReplyInfo: {
      type: string;
      content: string;
    };
    defaultMessageReplyInfoList: Array<{
      type: string;
      content: string;
    }>;
    keywordAutoreplyInfoList: Array<{
      keyword: string;
      matchMode: number;
      replyListInfo: Array<any>;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/get_current_autoreply_info');

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get auto reply info failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get auto reply info:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 群发消息 API ====================

  /**
   * 根据标签进行群发
   */
  async sendMassMessageByTag(data: {
    filter: { isToAll: boolean; tagId?: number };
    mpnews?: { mediaId: string };
    msgtype: 'mpnews' | 'text' | 'voice' | 'image' | 'mpvideo' | 'wxcard';
    text?: { content: string };
    voice?: { mediaId: string };
    image?: { mediaId: string };
    mpvideo?: { mediaId: string };
    wxcard?: { cardId: string };
    sendIgnoreReprint?: number;
  }): Promise<{ errcode: number; errmsg: string; msgId: number; msgDataId: number }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/message/mass/sendall', data);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Send mass message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to send mass message:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 根据OpenID列表群发
   */
  async sendMassMessageByOpenId(data: {
    touser: string[];
    mpnews?: { mediaId: string };
    msgtype: 'mpnews' | 'text' | 'voice' | 'image' | 'mpvideo' | 'wxcard';
    text?: { content: string };
    voice?: { mediaId: string };
    image?: { mediaId: string };
    mpvideo?: { mediaId: string };
    wxcard?: { cardId: string };
    sendIgnoreReprint?: number;
  }): Promise<{ errcode: number; errmsg: string; msgId: number; msgDataId: number }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/message/mass/send', data);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Send mass message by openid failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to send mass message by openid:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 删除群发
   */
  async deleteMassMessage(msgId: number, articleIdx?: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const data: any = { msgId };
      if (articleIdx !== undefined) data.articleIdx = articleIdx;

      const response = await this.httpClient.post('/cgi-bin/message/mass/delete', data);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Delete mass message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to delete mass message:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 预览接口
   */
  async previewMassMessage(data: {
    touser: string;
    mpnews?: { mediaId: string };
    msgtype: 'mpnews' | 'text' | 'voice' | 'image' | 'mpvideo' | 'wxcard';
    text?: { content: string };
    voice?: { mediaId: string };
    image?: { mediaId: string };
    mpvideo?: { mediaId: string };
    wxcard?: { cardId: string };
  }): Promise<{ errcode: number; errmsg: string; msgId: number }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/message/mass/preview', data);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Preview mass message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to preview mass message:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 订阅通知 API ====================

  /**
   * 发送订阅通知
   */
  async sendSubscribeMessage(data: {
    touser: string;
    templateId: string;
    page?: string;
    miniprogram?: { appId: string; pagePath: string };
    data: Record<string, { value: string }>;
  }): Promise<{ errcode: number; errmsg: string; msgid: number }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/message/subscribe/send', data);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Send subscribe message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to send subscribe message:', (error as any)?.message ?? String(error));
      throw error;
    }
  }
}
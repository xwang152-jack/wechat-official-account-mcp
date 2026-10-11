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
    content_source_url?: string;
    thumb_media_id: string;
    show_cover_pic?: number;
    need_open_comment?: number;
    only_fans_can_comment?: number;
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
   * 新增永久素材（图片/语音/视频/缩略图）
   * 用于封面上传等场景，返回 media_id 可在图文消息中引用
   */
  async addPermanentMaterial(params: {
    type: 'image' | 'voice' | 'video' | 'thumb';
    media: Buffer;
    fileName: string;
    title?: string;
    introduction?: string;
  }): Promise<{ mediaId: string; url?: string }> {
    try {
      const formData = new FormData();
      formData.append('media', params.media, params.fileName);

      if (params.type === 'video') {
        const description = {
          title: params.title || params.fileName,
          introduction: params.introduction || '',
        };
        formData.append('description', JSON.stringify(description));
      }

      const response = await this.httpClient.post(
        `/cgi-bin/material/add_material?type=${params.type}`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

      if (response.data.errcode) {
        throw new Error(`Add permanent material failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        mediaId: response.data.media_id,
        url: response.data.url,
      };
    } catch (error) {
      logger.error('Failed to add permanent material:', (error as any)?.message ?? String(error));
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

      return {
        total: response.data.total,
        count: response.data.count,
        data: { openid: response.data.data?.openid ?? [] },
        // 微信返回 next_openid；这里统一转成 camelCase 供工具层使用
        nextOpenid: response.data.next_openid ?? '',
      };
    } catch (error) {
      logger.error('Failed to get user list:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取用户基本信息
   */
  /**
   * 把微信返回的用户资料（snake_case）转换为工具层的 camelCase。
   * 微信字段：headimgurl / subscribe_time / unionid / groupid / tagid_list
   */
  private normalizeUserInfo(raw: any): Record<string, unknown> {
    return {
      subscribe: raw.subscribe,
      openid: raw.openid,
      nickname: raw.nickname,
      sex: raw.sex,
      language: raw.language,
      city: raw.city,
      province: raw.province,
      country: raw.country,
      headImgUrl: raw.headimgurl ?? null,
      subscribeTime: raw.subscribe_time ?? null,
      unionId: raw.unionid ?? null,
      remark: raw.remark ?? null,
      groupId: raw.groupid ?? null,
      tagidList: raw.tagid_list ?? [],
    };
  }

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

      return this.normalizeUserInfo(response.data) as any;
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

      return {
        user_info_list: (response.data.user_info_list ?? []).map((u: any) => this.normalizeUserInfo(u)),
      } as any;
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
      const response = await this.httpClient.post('/cgi-bin/menu/create', this.buildMenuPayload(menuData));

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
   * 把工具层的菜单结构（camelCase）转换为微信要求的字段名（snake_case）。
   * 按钮的 mediaId 需映射为 media_id，且要递归处理 sub_button。
   */
  private buildMenuPayload(menuData: {
    button: Array<{ type?: string; name: string; key?: string; url?: string; mediaId?: string; sub_button?: Array<any> }>;
  }): Record<string, unknown> {
    const mapButton = (btn: any): Record<string, unknown> => {
      const out: Record<string, unknown> = { name: btn.name };
      if (btn.type !== undefined) out.type = btn.type;
      if (btn.key !== undefined) out.key = btn.key;
      if (btn.url !== undefined) out.url = btn.url;
      if (btn.mediaId !== undefined) out.media_id = btn.mediaId;
      if (Array.isArray(btn.sub_button)) out.sub_button = btn.sub_button.map(mapButton);
      return out;
    };

    return { button: menuData.button.map(mapButton) };
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
      const response = await this.httpClient.post('/cgi-bin/menu/addconditional', {
        ...this.buildMenuPayload(menuData),
        matchrule: menuData.matchrule,
      });

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
      const body: Record<string, unknown> = {
        touser: data.touser,
        template_id: data.templateId,
        data: data.data,
      };
      if (data.url !== undefined) body.url = data.url;
      if (data.topcolor !== undefined) body.topcolor = data.topcolor;

      const response = await this.httpClient.post('/cgi-bin/message/template/send', body);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Send template message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        errcode: response.data.errcode ?? 0,
        errmsg: response.data.errmsg ?? 'ok',
        msgid: response.data.msgid,
      };
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

      return {
        template_list: (response.data.template_list ?? []).map((t: any) => ({
          templateId: t.template_id,
          title: t.title,
          content: t.content,
          example: t.example,
        })),
      };
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

      const mapIndustry = (raw: any) => raw
        ? { firstClass: raw.first_class ?? null, secondClass: raw.second_class ?? null }
        : { firstClass: null, secondClass: null };

      return {
        primary_industry: mapIndustry(response.data.primary_industry),
        secondary_industry: mapIndustry(response.data.secondary_industry),
      } as any;
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
      const body: Record<string, unknown> = {
        touser: data.touser,
        ...this.buildMessagePayload(data),
      };

      const response = await this.httpClient.post('/cgi-bin/message/custom/send', body);

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
   * @deprecated 官方已标注「本接口已停止维护」，请改用 getArticleRead / getArticleShare / getBizSummary / getArticleTotalDetail
   */
  async getArticleSummary(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      msgid: string;
      title: string;
      int_page_read_user: number;
      int_page_read_count: number;
      ori_page_read_user: number;
      ori_page_read_count: number;
      share_user: number;
      share_count: number;
      add_to_fav_user: number;
      add_to_fav_count: number;
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
   * @deprecated 官方已标注「本接口已停止维护」，请改用 getArticleTotalDetail
   */
  async getArticleTotal(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      msgid: string;
      title: string;
      details: Array<{
        stat_date: string;
        target_user: number;
        int_page_read_user: number;
        int_page_read_count: number;
        ori_page_read_user: number;
        ori_page_read_count: number;
        share_user: number;
        share_count: number;
        add_to_fav_user: number;
        add_to_fav_count: number;
      }>;
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
   * @deprecated 官方已标注「本接口已停止维护」，请改用 getArticleRead / getBizSummary
   */
  async getUserRead(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      user_source: number;
      int_page_read_user: number;
      int_page_read_count: number;
      ori_page_read_user: number;
      ori_page_read_count: number;
      share_user: number;
      share_count: number;
      add_to_fav_user: number;
      add_to_fav_count: number;
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
   * @deprecated 官方已标注「本接口已停止维护」，请改用 getArticleShare
   */
  async getUserShare(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      share_page: number;
      share_user: number;
      share_count: number;
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
      ref_date: string;
      msg_type: number;
      msg_user: number;
      msg_count: number;
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
      ref_date: string;
      callback_count: number;
      fail_count: number;
      total_time: number;
      max_time: number;
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
      ref_date: string;
      ref_hour: number;
      callback_count: number;
      fail_count: number;
      total_time: number;
      max_time: number;
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

  // ==================== 发表内容数据统计 API（新接口，数据自 2025-11-01 起） ====================

  /**
   * 获取发表内容每日阅读数据
   * 注意：日期范围仅支持查询 1 天，仅认证账号可调用
   */
  async getArticleRead(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      msgid: string;
      detail: {
        read_user: number;
        read_user_source: Array<{ user_count: number; scene_desc: string }>;
      };
    }>;
    is_delay: boolean;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getarticleread', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get article read failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get article read:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取发表内容每日分享数据
   * 注意：日期范围仅支持查询 1 天，仅认证账号可调用
   */
  async getArticleShare(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      msgid: string;
      detail: { share_user: number };
    }>;
    is_delay: boolean;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getarticleshare', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get article share failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get article share:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取发表内容概况总数据
   * 注意：日期范围最长 30 天，仅认证账号可调用
   */
  async getBizSummary(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      detail: {
        read_user: number;
        read_user_source: Array<{ user_count: number; scene_desc: string }>;
        share_user: number;
        zaikan_user: number;
        like_user: number;
        comment_count: number;
        collection_user: number;
        redirect_ori_page_user: number;
        send_page_count: number;
      };
    }>;
    is_delay: boolean;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getbizsummary', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get biz summary failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get biz summary:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取发表内容发表详细数据
   * 注意：日期范围仅支持查询 1 天，每篇内容仅统计发表日期起 30 天内数据
   */
  async getArticleTotalDetail(beginDate: string, endDate: string): Promise<{
    list: Array<{
      ref_date: string;
      msgid: string;
      publish_type: number;
      title: string;
      content_url: string;
      detail_list: Array<{
        stat_date: string;
        read_user: number;
        read_user_source: Array<{ user_count: number; scene_desc: string }>;
        share_user: number;
        zaikan_user: number;
        like_user: number;
        comment_count: number;
        collection_user: number;
        praise_money: number;
        read_subscribe_user: number;
        read_delivery_rate: number;
        read_finish_rate: number;
        read_avg_activetime: number;
      }>;
    }>;
    is_delay: boolean;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/datacube/getarticletotaldetail', {
        params: { begin_date: beginDate, end_date: endDate }
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get article total detail failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get article total detail:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 商品卡片 API ====================

  /**
   * 获取商品卡片的 DOM 结构
   * 用于在文章（图文消息/图片消息）中插入视频号小店商品卡片
   * @param cardType 0大卡 1小卡 2文字链接 3条卡
   */
  async getProductCardInfo(productId: string, articleType: 'news' | 'newspic', cardType: number): Promise<{
    productKey?: string;
    DOM?: string;
  }> {
    try {
      const response = await this.httpClient.post('/channels/ec/service/product/getcardinfo', {
        product_id: productId,
        article_type: articleType,
        card_type: cardType,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get product card info failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        productKey: response.data.product_key,
        DOM: response.data.DOM,
      };
    } catch (error) {
      logger.error('Failed to get product card info:', (error as any)?.message ?? String(error));
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

      // 微信返回的是完全不同名的 snake_case 结构，必须显式映射，
      // 否则工具层读到的每个字段都是 undefined
      const raw = response.data;
      return {
        isAddFriendReply: !!raw.is_add_friend_reply,
        isAutoReply: !!raw.is_autoreply,
        addFriendReplyInfo: raw.add_friend_autoreply_info
          ? { type: raw.add_friend_autoreply_info.type, content: raw.add_friend_autoreply_info.content }
          : undefined,
        defaultMessageReplyInfoList: (raw.message_default_autoreply_info?.default_reply_list ?? []).map((r: any) => ({
          type: r.type,
          content: r.content,
        })),
        keywordAutoreplyInfoList: (raw.keyword_autoreply_info?.list ?? []).map((k: any) => ({
          keyword: k.keyword,
          matchMode: k.match_mode,
          replyListInfo: (k.reply_list_info ?? []).map((r: any) => ({
            type: r.type,
            content: r.news_info ? r.news_info.list?.[0]?.title ?? '' : r.content,
          })),
        })),
      } as any;
    } catch (error) {
      logger.error('Failed to get auto reply info:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 群发消息 API ====================

  /**
   * 根据标签进行群发
   */
  /**
   * 把工具层的消息载荷（camelCase）转换为微信要求的字段名（snake_case）。
   *
   * 群发 / 预览 / 客服消息三个接口共用同一套消息体结构，之前直接透传 camelCase
   * 导致 media_id、card_id 等字段全部未被微信识别，消息实际发不出去。
   */
  private buildMessagePayload(data: {
    msgtype: 'mpnews' | 'text' | 'voice' | 'image' | 'mpvideo' | 'wxcard' | 'video' | 'music' | 'news';
    text?: { content: string };
    image?: { mediaId: string };
    voice?: { mediaId: string };
    video?: { mediaId: string; thumbMediaId: string; title?: string; description?: string };
    music?: { title: string; description: string; musicurl: string; hqmusicurl: string; thumbMediaId?: string };
    news?: { articles: Array<any> };
    mpnews?: { mediaId: string };
    mpvideo?: { mediaId: string };
    wxcard?: { cardId: string };
  }): Record<string, unknown> {
    const body: Record<string, unknown> = { msgtype: data.msgtype };

    if (data.text) body.text = data.text;
    if (data.image) body.image = { media_id: data.image.mediaId };
    if (data.voice) body.voice = { media_id: data.voice.mediaId };
    if (data.video) {
      body.video = {
        media_id: data.video.mediaId,
        thumb_media_id: data.video.thumbMediaId,
        title: data.video.title,
        description: data.video.description,
      };
    }
    if (data.music) {
      body.music = {
        title: data.music.title,
        description: data.music.description,
        musicurl: data.music.musicurl,
        hqmusicurl: data.music.hqmusicurl,
        thumb_media_id: data.music.thumbMediaId,
      };
    }
    if (data.news) body.news = data.news;
    if (data.mpnews) body.mpnews = { media_id: data.mpnews.mediaId };
    if (data.mpvideo) body.mpvideo = { media_id: data.mpvideo.mediaId };
    if (data.wxcard) body.wxcard = { card_id: data.wxcard.cardId };

    return body;
  }

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
  }): Promise<{ errcode: number; errmsg: string; msgId: number | null; msgDataId: number | null }> {
    try {
      const body: Record<string, unknown> = {
        filter: { is_to_all: data.filter.isToAll, tag_id: data.filter.tagId },
        ...this.buildMessagePayload(data),
      };
      if (data.sendIgnoreReprint !== undefined) body.send_ignore_reprint = data.sendIgnoreReprint;

      const response = await this.httpClient.post('/cgi-bin/message/mass/sendall', body);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Send mass message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        errcode: response.data.errcode ?? 0,
        errmsg: response.data.errmsg ?? 'ok',
        msgId: response.data.msg_id ?? null,
        msgDataId: response.data.msg_data_id ?? null,
      };
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
  }): Promise<{ errcode: number; errmsg: string; msgId: number | null; msgDataId: number | null }> {
    try {
      const body: Record<string, unknown> = {
        touser: data.touser,
        ...this.buildMessagePayload(data),
      };
      if (data.sendIgnoreReprint !== undefined) body.send_ignore_reprint = data.sendIgnoreReprint;

      const response = await this.httpClient.post('/cgi-bin/message/mass/send', body);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Send mass message by openid failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        errcode: response.data.errcode ?? 0,
        errmsg: response.data.errmsg ?? 'ok',
        msgId: response.data.msg_id ?? null,
        msgDataId: response.data.msg_data_id ?? null,
      };
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
      const body: Record<string, unknown> = { msg_id: msgId };
      if (articleIdx !== undefined) body.article_idx = articleIdx;

      const response = await this.httpClient.post('/cgi-bin/message/mass/delete', body);

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
      const body: Record<string, unknown> = {
        touser: data.touser,
        ...this.buildMessagePayload(data),
      };

      const response = await this.httpClient.post('/cgi-bin/message/mass/preview', body);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Preview mass message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        errcode: response.data.errcode ?? 0,
        errmsg: response.data.errmsg ?? 'ok',
        msgId: response.data.msg_id,
      };
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
      const body: Record<string, unknown> = {
        touser: data.touser,
        template_id: data.templateId,
        data: data.data,
      };
      if (data.page !== undefined) body.page = data.page;
      if (data.miniprogram) {
        body.miniprogram = {
          appid: data.miniprogram.appId,
          pagepath: data.miniprogram.pagePath,
        };
      }

      const response = await this.httpClient.post('/cgi-bin/message/subscribe/send', body);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Send subscribe message failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        errcode: response.data.errcode ?? 0,
        errmsg: response.data.errmsg ?? 'ok',
        msgid: response.data.msgid,
      };
    } catch (error) {
      logger.error('Failed to send subscribe message:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 二维码管理 API ====================

  /**
   * 创建二维码 Ticket
   */
  async createQrCode(data: {
    expireSeconds?: number;
    actionName: 'QR_SCENE' | 'QR_STR_SCENE' | 'QR_LIMIT_SCENE' | 'QR_LIMIT_STR_SCENE';
    sceneId?: number;
    sceneStr?: string;
  }): Promise<{ ticket: string; expireSeconds?: number; url: string }> {
    try {
      const scene: Record<string, unknown> = {};
      if (data.sceneId !== undefined) scene.scene_id = data.sceneId;
      if (data.sceneStr !== undefined) scene.scene_str = data.sceneStr;

      const requestData: Record<string, unknown> = {
        action_name: data.actionName,
        action_info: { scene },
      };
      if (data.expireSeconds !== undefined) requestData.expire_seconds = data.expireSeconds;

      const response = await this.httpClient.post('/cgi-bin/qrcode/create', requestData);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Create QR code failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        ticket: response.data.ticket,
        expireSeconds: response.data.expire_seconds,
        url: response.data.url,
      };
    } catch (error) {
      logger.error('Failed to create QR code:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 通过 Ticket 换取二维码图片 URL
   */
  getQrCodeUrl(ticket: string): string {
    return `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(ticket)}`;
  }

  // ==================== 短链接 API ====================

  /**
   * 长信息转短 key
   * 注意：/cgi-bin/shorten/gen 返回的是 15 字节 base62 短 key（需用 fetchShorten 还原），
   * 不是可直接点击的短链接。长信息不超过 4KB，有效期最长 30 天。
   */
  async genShortKey(longData: string, expireSeconds = 2592000): Promise<{ short_key: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/shorten/gen', {
        long_data: longData,
        expire_seconds: expireSeconds,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Generate short key failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return { short_key: response.data.short_key };
    } catch (error) {
      logger.error('Failed to generate short key:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 短 key 还原长信息
   */
  async fetchShorten(shortKey: string): Promise<{ long_data: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/shorten/fetch', {
        short_key: shortKey,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Fetch short key failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return { long_data: response.data.long_data };
    } catch (error) {
      logger.error('Failed to fetch short key:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 评论管理 API ====================

  /**
   * 打开已群发文章评论
   */
  async openComment(msgDataId: number, index: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/comment/open', {
        msg_data_id: msgDataId,
        index,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Open comment failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to open comment:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 关闭已群发文章评论
   */
  async closeComment(msgDataId: number, index: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/comment/close', {
        msg_data_id: msgDataId,
        index,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Close comment failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to close comment:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 查看指定文章的评论列表
   */
  async getCommentList(msgDataId: number, index: number, begin: number, count: number, type: number): Promise<{
    total: number;
    comment: Array<{
      userCommentId: number;
      createTime: number;
      content: string;
      commentType: number;
      openid: string;
      reply?: {
        content: string;
        createTime: number;
      };
    }>;
  }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/comment/list', {
        msg_data_id: msgDataId,
        index,
        begin,
        count,
        type,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get comment list failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return {
        total: response.data.total ?? 0,
        comment: (response.data.comment ?? []).map((c: any) => ({
          userCommentId: c.user_comment_id,
          createTime: c.create_time,
          content: c.content,
          commentType: c.comment_type,
          openid: c.openid ?? null,
          reply: c.reply
            ? { content: c.reply.content, createTime: c.reply.create_time }
            : undefined,
        })),
      };
    } catch (error) {
      logger.error('Failed to get comment list:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 标记为精选评论
   */
  async markElectComment(msgDataId: number, index: number, userCommentId: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/comment/markelect', {
        msg_data_id: msgDataId,
        index,
        user_comment_id: userCommentId,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Mark elect comment failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to mark elect comment:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 取消精选评论
   */
  async unmarkElectComment(msgDataId: number, index: number, userCommentId: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/comment/unmarkelect', {
        msg_data_id: msgDataId,
        index,
        user_comment_id: userCommentId,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Unmark elect comment failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to unmark elect comment:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 删除评论
   */
  async deleteComment(msgDataId: number, index: number, userCommentId: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/comment/delete', {
        msg_data_id: msgDataId,
        index,
        user_comment_id: userCommentId,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Delete comment failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to delete comment:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 回复评论
   */
  async replyComment(msgDataId: number, index: number, userCommentId: number, content: string): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/comment/reply/add', {
        msg_data_id: msgDataId,
        index,
        user_comment_id: userCommentId,
        content,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Reply comment failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to reply comment:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 删除评论回复
   */
  async deleteCommentReply(msgDataId: number, index: number, userCommentId: number, replyId: number): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/comment/reply/delete', {
        msg_data_id: msgDataId,
        index,
        user_comment_id: userCommentId,
        reply_id: replyId,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Delete comment reply failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to delete comment reply:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 黑名单管理 API ====================

  /**
   * 获取黑名单列表
   */
  async getBlackList(beginOpenId?: string): Promise<{
    total: number;
    count: number;
    data: { openid: string[] };
    next_openid: string;
  }> {
    try {
      const requestData: Record<string, unknown> = {};
      if (beginOpenId) requestData.begin_openid = beginOpenId;

      const response = await this.httpClient.post('/cgi-bin/tags/members/getblacklist', requestData);

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get blacklist failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get blacklist:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 拉黑用户
   */
  async batchBlackList(openIdList: string[]): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/tags/members/batchblacklist', {
        openid_list: openIdList,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Batch blacklist failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to batch blacklist:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 取消拉黑用户
   */
  async batchUnBlackList(openIdList: string[]): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/tags/members/batchunblacklist', {
        openid_list: openIdList,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Batch unblacklist failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to batch unblacklist:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 客服账号管理 API ====================

  /**
   * 添加客服账号
   */
  async addKfAccount(kfAccount: string, nickname: string, password: string): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/customservice/kfaccount/add', {
        kf_account: kfAccount,
        nickname,
        password,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Add kf account failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to add kf account:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 修改客服账号
   */
  async updateKfAccount(kfAccount: string, nickname: string, password: string): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/customservice/kfaccount/update', {
        kf_account: kfAccount,
        nickname,
        password,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Update kf account failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to update kf account:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 删除客服账号
   */
  async deleteKfAccount(kfAccount: string): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/customservice/kfaccount/del', {
        kf_account: kfAccount,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Delete kf account failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to delete kf account:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取客服列表
   */
  async getKfList(): Promise<{
    kf_list: Array<{
      kf_account: string;
      kf_nick: string;
      kf_id: string;
      kf_headimgurl: string;
    }>;
  }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/customservice/getkflist');

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get kf list failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get kf list:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  // ==================== 账号管理 API ====================

  /**
   * 重置 API 调用次数
   */
  async clearQuota(): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/clear_quota', {
        appid: this.authManager.getAppId(),
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Clear quota failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to clear quota:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 查询 API 调用次数配额
   */
  async getApiQuota(cgiPath: string): Promise<{
    quota: {
      daily_limit: number;
      used: number;
      remain: number;
    };
  }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/openapi/quota/get', {
        cgi_path: cgiPath,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get API quota failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get API quota:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 重置指定接口的调用次数
   * 与 clearQuota 的重置全部不同，本接口只清空 cgiPath 对应接口的每日调用量
   */
  async clearApiQuota(cgiPath: string): Promise<{ errcode: number; errmsg: string }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/openapi/quota/clear', {
        cgi_path: cgiPath,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Clear API quota failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to clear API quota:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 查询 rid 详情
   * 用接口报错返回的 rid 定位问题根因
   */
  async getRidInfo(rid: string): Promise<{
    request: {
      invoke_time: number;
      cost_in_ms: number;
      request_url: string;
      request_body: string;
      response_body: string;
    };
  }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/openapi/rid/get', { rid });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get rid info failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get rid info:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 获取微信 API 服务器 IP 地址
   * 用于配置开发者服务器出口白名单/排查连通性
   */
  async getApiDomainIp(): Promise<{ ip_list: string[] }> {
    try {
      const response = await this.httpClient.get('/cgi-bin/get_api_domain_ip');

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Get API domain ip failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to get API domain ip:', (error as any)?.message ?? String(error));
      throw error;
    }
  }

  /**
   * 转换 openid
   * 账号迁移/主体变更后，用旧 AppID 的 openid 换新 AppID 的 openid
   */
  async changeOpenId(fromAppId: string, openIdList: string[]): Promise<{
    result_list: Array<{
      ori_openid: string;
      new_openid: string;
      errmsg?: string;
    }>;
  }> {
    try {
      const response = await this.httpClient.post('/cgi-bin/changeopenid', {
        from_appid: fromAppId,
        openid_list: openIdList,
      });

      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(`Change openid failed: ${response.data.errmsg} (${response.data.errcode})`);
      }

      return response.data;
    } catch (error) {
      logger.error('Failed to change openid:', (error as any)?.message ?? String(error));
      throw error;
    }
  }
}
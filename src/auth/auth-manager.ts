import { WechatConfig, AccessTokenInfo } from '../mcp-tool/types.js';
import { StorageManager } from '../storage/storage-manager.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

/**
 * 微信公众号认证管理器
 * 负责管理 AppID、AppSecret 和 Access Token
 */
export class AuthManager {
  private storageManager: StorageManager;
  private config: WechatConfig | null = null;
  private tokenInfo: AccessTokenInfo | null = null;

  constructor() {
    this.storageManager = new StorageManager();
  }

  /**
   * 初始化认证管理器
   */
  async initialize(): Promise<void> {
    await this.storageManager.initialize();
    
    // 加载配置
    this.config = await this.storageManager.getConfig();
    
    // 加载 Access Token
    this.tokenInfo = await this.storageManager.getAccessToken();
    
    logger.info('AuthManager initialized');
  }

  /**
   * 设置微信公众号配置
   */
  async setConfig(config: WechatConfig): Promise<void> {
    this.config = config;
    await this.storageManager.saveConfig(config);
    
    // 配置更新后清除旧的 Access Token
    this.tokenInfo = null;
    await this.storageManager.clearAccessToken();
    
    logger.info('Wechat config updated');
  }

  /**
   * 获取微信公众号配置
   */
  async getConfig(): Promise<WechatConfig | null> {
    if (!this.config) {
      this.config = await this.storageManager.getConfig();
    }
    return this.config;
  }

  /**
   * 获取有效的 Access Token
   */
  async getAccessToken(): Promise<AccessTokenInfo> {
    // 检查是否有有效的 Token
    if (this.tokenInfo && this.tokenInfo.expiresAt > Date.now() + 60000) { // 提前1分钟刷新
      return this.tokenInfo;
    }

    // 刷新 Token
    return await this.refreshAccessToken();
  }

  /**
   * 刷新 Access Token
   */
  async refreshAccessToken(): Promise<AccessTokenInfo> {
    if (!this.config) {
      throw new Error('Wechat config not found. Please configure first.');
    }

    try {
      const response = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
        params: {
          grant_type: 'client_credential',
          appid: this.config.appId,
          secret: this.config.appSecret,
        },
        timeout: 10000,
      });

      if (response.data.errcode) {
        throw new Error(`Failed to get access token: ${response.data.errmsg} (${response.data.errcode})`);
      }

      const { access_token, expires_in } = response.data;
      const expiresAt = Date.now() + (expires_in * 1000);

      this.tokenInfo = {
        accessToken: access_token,
        expiresIn: expires_in,
        expiresAt,
      };

      // 保存到存储
      await this.storageManager.saveAccessToken(this.tokenInfo);
      
      logger.info('Access token refreshed successfully');
      return this.tokenInfo;
    } catch (error) {
      logger.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  /**
   * 检查配置是否完整
   */
  isConfigured(): boolean {
    return !!(this.config?.appId && this.config?.appSecret);
  }

  /**
   * 清除所有认证信息
   */
  async clearAuth(): Promise<void> {
    this.config = null;
    this.tokenInfo = null;
    await this.storageManager.clearConfig();
    await this.storageManager.clearAccessToken();
    logger.info('Auth cleared');
  }
}
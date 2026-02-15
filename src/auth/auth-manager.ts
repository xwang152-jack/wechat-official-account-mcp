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
  private refreshPromise: Promise<AccessTokenInfo> | null = null; // Token 刷新锁

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
   * 使用缓存和后台刷新策略优化性能
   */
  async getAccessToken(): Promise<AccessTokenInfo> {
    // 检查是否有有效的 Token (提前5分钟刷新)
    const REFRESH_BEFORE_EXPIRY = 5 * 60 * 1000; // 5分钟

    if (this.tokenInfo && this.tokenInfo.expiresAt > Date.now() + REFRESH_BEFORE_EXPIRY) {
      return this.tokenInfo;
    }

    // 如果正在刷新,等待刷新完成
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // 启动后台刷新
    this.refreshPromise = this.refreshAccessToken();

    try {
      const tokenInfo = await this.refreshPromise;
      return tokenInfo;
    } finally {
      this.refreshPromise = null;
    }
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
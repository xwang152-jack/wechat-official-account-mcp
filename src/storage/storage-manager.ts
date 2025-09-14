import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { WechatConfig, AccessTokenInfo, MediaInfo, PermanentMediaInfo, DraftInfo, PublishInfo } from '../mcp-tool/types.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 存储管理器
 * 使用 SQLite 数据库存储配置、令牌和素材信息
 */
export class StorageManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(__dirname, '../../data/wechat-mcp.db');
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 确保数据目录存在
      const dataDir = path.dirname(this.dbPath);
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('Failed to open database:', err);
          reject(err);
          return;
        }

        this.createTables()
          .then(() => {
            logger.info('Storage manager initialized');
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /**
   * 创建数据表
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));

    // 配置表
    await run(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY,
        app_id TEXT NOT NULL,
        app_secret TEXT NOT NULL,
        token TEXT,
        encoding_aes_key TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Access Token 表
    await run(`
      CREATE TABLE IF NOT EXISTS access_tokens (
        id INTEGER PRIMARY KEY,
        access_token TEXT NOT NULL,
        expires_in INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // 临时素材表
    await run(`
      CREATE TABLE IF NOT EXISTS media (
        media_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        url TEXT
      )
    `);

    // 永久素材表
    await run(`
      CREATE TABLE IF NOT EXISTS permanent_media (
        media_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT,
        created_at INTEGER NOT NULL,
        update_time INTEGER,
        url TEXT
      )
    `);

    // 草稿表
    await run(`
      CREATE TABLE IF NOT EXISTS drafts (
        media_id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        update_time INTEGER NOT NULL
      )
    `);

    // 发布记录表
    await run(`
      CREATE TABLE IF NOT EXISTS publishes (
        publish_id TEXT PRIMARY KEY,
        msg_data_id TEXT NOT NULL,
        idx INTEGER,
        article_url TEXT,
        content TEXT,
        publish_time INTEGER NOT NULL,
        publish_status INTEGER NOT NULL
      )
    `);
  }

  /**
   * 保存配置
   */
  async saveConfig(config: WechatConfig): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));
    const now = Date.now();

    await run(
      `INSERT OR REPLACE INTO config (id, app_id, app_secret, token, encoding_aes_key, created_at, updated_at) 
       VALUES (1, ?, ?, ?, ?, ?, ?)`,
      [config.appId, config.appSecret, config.token || null, config.encodingAESKey || null, now, now]
    );
  }

  /**
   * 获取配置
   */
  async getConfig(): Promise<WechatConfig | null> {
    if (!this.db) throw new Error('Database not initialized');

    const get = promisify(this.db.get.bind(this.db));
    const row = await get('SELECT * FROM config WHERE id = 1') as any;

    if (!row) return null;

    return {
      appId: row.app_id,
      appSecret: row.app_secret,
      token: row.token,
      encodingAESKey: row.encoding_aes_key,
    };
  }

  /**
   * 清除配置
   */
  async clearConfig(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));
    await run('DELETE FROM config WHERE id = 1');
  }

  /**
   * 保存 Access Token
   */
  async saveAccessToken(tokenInfo: AccessTokenInfo): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));
    await run('DELETE FROM access_tokens'); // 清除旧的 token
    await run(
      'INSERT INTO access_tokens (access_token, expires_in, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [tokenInfo.accessToken, tokenInfo.expiresIn, tokenInfo.expiresAt, Date.now()]
    );
  }

  /**
   * 获取 Access Token
   */
  async getAccessToken(): Promise<AccessTokenInfo | null> {
    if (!this.db) throw new Error('Database not initialized');

    const get = promisify(this.db.get.bind(this.db));
    const row = await get('SELECT * FROM access_tokens ORDER BY created_at DESC LIMIT 1') as any;

    if (!row) return null;

    return {
      accessToken: row.access_token,
      expiresIn: row.expires_in,
      expiresAt: row.expires_at,
    };
  }

  /**
   * 清除 Access Token
   */
  async clearAccessToken(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));
    await run('DELETE FROM access_tokens');
  }

  /**
   * 保存素材信息
   */
  async saveMedia(media: MediaInfo): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));
    await run(
      'INSERT OR REPLACE INTO media (media_id, type, created_at, url) VALUES (?, ?, ?, ?)',
      [media.mediaId, media.type, media.createdAt, media.url || null]
    );
  }

  /**
   * 获取素材信息
   */
  async getMedia(mediaId: string): Promise<MediaInfo | null> {
    if (!this.db) throw new Error('Database not initialized');

    const get = promisify(this.db.get.bind(this.db));
    const row = await get('SELECT * FROM media WHERE media_id = ?', [mediaId]) as any;

    if (!row) return null;

    return {
      mediaId: row.media_id,
      type: row.type,
      createdAt: row.created_at,
      url: row.url,
    };
  }

  /**
   * 列出素材
   */
  async listMedia(type?: string): Promise<MediaInfo[]> {
    if (!this.db) throw new Error('Database not initialized');

    const all = promisify(this.db.all.bind(this.db));
    const query = type 
      ? 'SELECT * FROM media WHERE type = ? ORDER BY created_at DESC'
      : 'SELECT * FROM media ORDER BY created_at DESC';
    const params = type ? [type] : [];
    
    const rows = await all(query, params) as any[];

    return rows.map(row => ({
      mediaId: row.media_id,
      type: row.type,
      createdAt: row.created_at,
      url: row.url,
    }));
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            logger.error('Failed to close database:', err);
            reject(err);
          } else {
            logger.info('Database connection closed');
            resolve();
          }
        });
      });
    }
  }
}
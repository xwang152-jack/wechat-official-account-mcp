#!/usr/bin/env tsx

import { StorageManager } from '../storage/storage-manager.js';
import { logger } from './logger.js';

/**
 * 数据库初始化脚本
 * 用于创建数据库表结构
 */
async function initDatabase() {
  try {
    logger.info('Initializing database...');
    
    const storageManager = new StorageManager();
    await storageManager.initialize();
    
    logger.info('Database initialized successfully!');
    
    // 关闭数据库连接
    await storageManager.close();
    
    process.exit(0);
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase();
}

export { initDatabase };
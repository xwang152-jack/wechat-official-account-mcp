#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { initMcpServerWithTransport } from './mcp-server/shared/init.js';
import { logger } from './utils/logger.js';
import { McpServerOptions } from './mcp-server/shared/types.js';

const program = new Command();

function getVersion(): string {
  const candidates = [
    '../../package.json',
    '../package.json',
    '../../../package.json',
  ];

  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(readFileSync(new URL(candidate, import.meta.url), 'utf-8'));
      return pkg.version || '1.0.0';
    } catch {
      continue;
    }
  }

  return '1.0.0';
}

program
  .name('wechat-mcp')
  .description('WeChat Official Account MCP Server')
  .version(getVersion());

program
  .command('mcp')
  .description('Start WeChat MCP server')
  .option('-a, --app-id <appId>', 'WeChat App ID')
  .option('-s, --app-secret <appSecret>', 'WeChat App Secret')
  .option('-m, --mode <mode>', 'Transport mode (stdio|sse)', 'stdio')
  .option('-p, --port <port>', 'Port for SSE mode', '3000')
  .action(async (options) => {
    const { appId, appSecret, mode, port } = options;

    if (!appId || !appSecret) {
      logger.error('App ID and App Secret are required');
      logger.info('Usage: npx wechat-mcp mcp -a <app_id> -s <app_secret>');
      process.exit(1);
    }

    const serverOptions: McpServerOptions = {
      appId,
      appSecret,
      mode: mode as 'stdio' | 'sse',
      port: port
    };

    try {
      logger.info(`Starting WeChat MCP Server in ${mode} mode...`);
      // 只记录 App ID 的前8个字符,避免泄露完整凭证
      logger.info(`App ID: ${appId.substring(0, 8)}...`);

      await initMcpServerWithTransport(serverOptions);
    } catch (error) {
      logger.error(`Failed to start MCP server: ${error}`);
      process.exit(1);
    }
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(`WeChat Official Account MCP Server v${getVersion()}`);
  });

program
  .command('help')
  .description('Show help information')
  .action(() => {
    console.log('WeChat Official Account MCP Server');
    console.log('');
    console.log('Usage:');
    console.log('  npx wechat-mcp mcp -a <app_id> -s <app_secret>');
    console.log('');
    console.log('Options:');
    console.log('  -a, --app-id <appId>        WeChat App ID');
    console.log('  -s, --app-secret <appSecret> WeChat App Secret');
    console.log('  -m, --mode <mode>           Transport mode (stdio|sse), default: stdio');
    console.log('  -p, --port <port>           Port for SSE mode, default: 3000');
    console.log('');
    console.log('Examples:');
    console.log('  npx wechat-mcp mcp -a wx1234567890 -s abcdef1234567890');
    console.log('  npx wechat-mcp mcp -a wx1234567890 -s abcdef1234567890 -m sse -p 3001');
  });

program.parse();

// 全局错误处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

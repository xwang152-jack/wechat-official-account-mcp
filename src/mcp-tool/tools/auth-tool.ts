import { z } from 'zod';
import { WechatToolDefinition, WechatToolContext, WechatToolResult, McpTool, WechatApiClient } from '../types.js';
import { logger } from '../../utils/logger.js';

// 认证工具参数 Schema
const authToolSchema = z.object({
  action: z.enum(['configure', 'get_token', 'refresh_token', 'get_config']),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  token: z.string().optional(),
  encodingAESKey: z.string().optional(),
});

/**
 * 认证工具处理器
 */
async function handleAuthTool(context: WechatToolContext): Promise<WechatToolResult> {
  const { args, authManager } = context;
  
  try {
    const validatedArgs = authToolSchema.parse(args);
    const { action, appId, appSecret, token, encodingAESKey } = validatedArgs;

    switch (action) {
      case 'configure': {
        if (!appId || !appSecret) {
          throw new Error('appId and appSecret are required for configuration');
        }
        
        await authManager.setConfig({
          appId,
          appSecret,
          token,
          encodingAESKey,
        });
        
        return {
          content: [{
            type: 'text',
            text: `微信公众号配置已成功保存\n- AppID: ${appId}\n- Token: ${token || '未设置'}\n- EncodingAESKey: ${encodingAESKey || '未设置'}`,
          }],
        };
      }
      
      case 'get_token': {
        const tokenInfo = await authManager.getAccessToken();
        const expiresIn = Math.max(0, Math.floor((tokenInfo.expiresAt - Date.now()) / 1000));
        
        return {
          content: [{
            type: 'text',
            text: `Access Token 信息:\n- Token: ${tokenInfo.accessToken}\n- 剩余有效时间: ${expiresIn} 秒\n- 过期时间: ${new Date(tokenInfo.expiresAt).toLocaleString()}`,
          }],
        };
      }
      
      case 'refresh_token': {
        const tokenInfo = await authManager.refreshAccessToken();
        const expiresIn = Math.max(0, Math.floor((tokenInfo.expiresAt - Date.now()) / 1000));
        
        return {
          content: [{
            type: 'text',
            text: `Access Token 已刷新:\n- 新 Token: ${tokenInfo.accessToken}\n- 有效时间: ${expiresIn} 秒\n- 过期时间: ${new Date(tokenInfo.expiresAt).toLocaleString()}`,
          }],
        };
      }
      
      case 'get_config': {
        const config = await authManager.getConfig();
        if (!config) {
          return {
            content: [{
              type: 'text',
              text: '尚未配置微信公众号信息，请先使用 configure 操作进行配置。',
            }],
          };
        }
        
        return {
          content: [{
            type: 'text',
            text: `当前微信公众号配置:\n- AppID: ${config.appId}\n- AppSecret: ${config.appSecret.substring(0, 8)}...\n- Token: ${config.token || '未设置'}\n- EncodingAESKey: ${config.encodingAESKey || '未设置'}`,
          }],
        };
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    logger.error('Auth tool error:', error);
    return {
      content: [{
        type: 'text',
        text: `认证操作失败: ${error instanceof Error ? error.message : '未知错误'}`,
      }],
      isError: true,
    };
  }
}

/**
 * MCP认证工具处理器
 */
async function handleAuthMcpTool(args: any, apiClient: WechatApiClient): Promise<WechatToolResult> {
  // 注意：这里需要从外部传入authManager，因为WechatApiClient没有公开getAuthManager方法
  // 暂时返回错误信息，需要重新设计这个接口
  return {
    content: [{
      type: 'text',
      text: 'Auth tool not available in MCP mode - requires authManager access'
    }],
    isError: true
  };
}

/**
 * 微信公众号认证工具
 */
export const authTool: WechatToolDefinition = {
  name: 'wechat_auth',
  description: '管理微信公众号认证配置和 Access Token',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['configure', 'get_token', 'refresh_token', 'get_config'],
        description: '操作类型：configure(配置), get_token(获取令牌), refresh_token(刷新令牌), get_config(获取配置)',
      },
      appId: {
        type: 'string',
        description: '微信公众号 AppID（配置时必需）',
      },
      appSecret: {
        type: 'string',
        description: '微信公众号 AppSecret（配置时必需）',
      },
      token: {
        type: 'string',
        description: '微信公众号 Token（可选，用于消息验证）',
      },
      encodingAESKey: {
        type: 'string',
        description: '微信公众号 EncodingAESKey（可选，用于消息加密）',
      },
    },
    required: ['action'],
  },
  handler: handleAuthTool,
};

/**
 * MCP认证工具
 */
export const authMcpTool: McpTool = {
  name: 'wechat_auth',
  description: '管理微信公众号认证配置和 Access Token',
  inputSchema: {
    action: z.enum(['configure', 'get_token', 'refresh_token', 'get_config']).describe('操作类型：configure(配置), get_token(获取令牌), refresh_token(刷新令牌), get_config(获取配置)'),
    appId: z.string().optional().describe('微信公众号 AppID（配置时必需）'),
    appSecret: z.string().optional().describe('微信公众号 AppSecret（配置时必需）'),
    token: z.string().optional().describe('微信公众号 Token（可选，用于消息验证）'),
    encodingAESKey: z.string().optional().describe('微信公众号 EncodingAESKey（可选，用于消息加密）'),
  },
  handler: handleAuthMcpTool,
};
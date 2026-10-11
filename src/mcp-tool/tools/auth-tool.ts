import { z } from 'zod';
import { WechatToolDefinition, WechatToolContext, WechatToolResult, McpTool, WechatApiClient } from '../types.js';
import { AuthManager } from '../../auth/auth-manager.js';
import { appIdSchema, appSecretSchema } from '../../utils/validation.js';
import { jsonResult } from '../json-result.js';

// 认证工具参数 Schema
const authToolSchema = z.object({
  action: z.enum(['configure', 'get_token', 'refresh_token', 'get_config']),
  appId: appIdSchema.optional(),
  appSecret: appSecretSchema.optional(),
  token: z.string().max(128, 'Token长度不能超过128个字符').optional(),
  encodingAESKey: z.string().length(43, 'EncodingAESKey必须为43个字符').optional(),
});

/**
 * 认证工具核心处理逻辑
 */
async function handleAuthCore(args: unknown, authManager: AuthManager): Promise<WechatToolResult> {
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

      return jsonResult({
        action: 'configure',
        configured: true,
        appId,
        hasToken: Boolean(token),
        hasEncodingAESKey: Boolean(encodingAESKey),
      });
    }

    case 'get_token': {
      const tokenInfo = await authManager.getAccessToken();
      const expiresIn = Math.max(0, Math.floor((tokenInfo.expiresAt - Date.now()) / 1000));

      return jsonResult({
        action: 'get_token',
        expiresIn,
        expiresAt: tokenInfo.expiresAt,
        expiresAtIso: new Date(tokenInfo.expiresAt).toISOString(),
      });
    }

    case 'refresh_token': {
      const tokenInfo = await authManager.refreshAccessToken();
      const expiresIn = Math.max(0, Math.floor((tokenInfo.expiresAt - Date.now()) / 1000));

      return jsonResult({
        action: 'refresh_token',
        refreshed: true,
        expiresIn,
        expiresAt: tokenInfo.expiresAt,
        expiresAtIso: new Date(tokenInfo.expiresAt).toISOString(),
      });
    }

    case 'get_config': {
      const config = await authManager.getConfig();
      if (!config) {
        return jsonResult({
          action: 'get_config',
          configured: false,
          appId: null,
          hasAppSecret: false,
          hasToken: false,
          hasEncodingAESKey: false,
        });
      }

      return jsonResult({
        action: 'get_config',
        configured: true,
        appId: config.appId,
        hasAppSecret: Boolean(config.appSecret),
        hasToken: Boolean(config.token),
        hasEncodingAESKey: Boolean(config.encodingAESKey),
      });
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * 认证工具处理器 (WechatToolContext)
 */
async function handleAuthTool(context: WechatToolContext): Promise<WechatToolResult> {
  return handleAuthCore(context.args, context.authManager);
}

/**
 * MCP认证工具处理器
 */
async function handleAuthMcpTool(args: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> {
  return handleAuthCore(args, apiClient.getAuthManager());
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

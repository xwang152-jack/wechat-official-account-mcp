import { WechatApiClient } from '../wechat/api-client.js';
import { AuthManager } from '../auth/auth-manager.js';
import { ZodRawShape } from 'zod';

// 重新导出 WechatApiClient 类型
export { WechatApiClient };

/**
 * 微信工具参数类型
 */
export interface WechatToolArgs {
  [key: string]: unknown;
}

/**
 * 微信工具结果类型
 */
export interface WechatToolResult {
  [x: string]: unknown;
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    uri?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * 工具执行上下文
 */
export interface WechatToolContext {
  args: WechatToolArgs;
  apiClient: WechatApiClient;
  authManager: AuthManager;
}

/**
 * 微信工具处理器类型
 */
export type WechatToolHandler = (context: WechatToolContext) => Promise<WechatToolResult>;

/**
 * 微信工具定义
 */
export interface WechatToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: WechatToolHandler;
}

/**
 * MCP工具处理器类型
 */
export type McpToolHandler = (params: unknown, apiClient: WechatApiClient) => Promise<WechatToolResult>;

/**
 * MCP 工具注解
 * 参照 Anthropic connector 审核标准：每个工具必须提供 title，
 * 以及 readOnlyHint / destructiveHint 中适用的那一项。
 * 这些注解决定 Claude 的自动授权行为——只读工具可免逐次确认，破坏性工具必定弹确认。
 */
export interface McpToolAnnotations {
  /** 人类可读的工具标题 */
  title: string;
  /** 工具不修改任何数据。为 true 时 destructiveHint 无意义 */
  readOnlyHint: boolean;
  /** 工具可能删除或覆盖已有数据（区别于纯新增操作） */
  destructiveHint: boolean;
  /** 相同参数重复调用不产生额外副作用 */
  idempotentHint?: boolean;
}

/**
 * MCP工具定义
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: McpToolHandler;
}

/**
 * 微信公众号配置
 */
export interface WechatConfig {
  appId: string;
  appSecret: string;
  token?: string;
  encodingAESKey?: string;
}

/**
 * Access Token 信息
 */
export interface AccessTokenInfo {
  accessToken: string;
  expiresIn: number;
  expiresAt: number;
}

/**
 * 素材信息
 */
export interface MediaInfo {
  mediaId: string;
  type: 'image' | 'voice' | 'video' | 'thumb';
  createdAt: number;
  url?: string;
}

/**
 * 永久素材信息
 */
export interface PermanentMediaInfo extends MediaInfo {
  name?: string;
  updateTime?: number;
}

/**
 * 草稿信息
 */
export interface DraftInfo {
  mediaId: string;
  content: {
    newsItem: Array<{
      title: string;
      author?: string;
      digest?: string;
      content: string;
      contentSourceUrl?: string;
      thumbMediaId: string;
      showCoverPic?: number;
      needOpenComment?: number;
      onlyFansCanComment?: number;
    }>;
  };
  updateTime: number;
}

/**
 * 发布任务信息
 */
export interface PublishInfo {
  publishId: string;
  msgDataId: string;
  idx?: number;
  articleUrl?: string;
  content?: {
    title: string;
    author?: string;
    digest?: string;
    content: string;
    contentSourceUrl?: string;
    thumbUrl?: string;
  };
  publishTime: number;
  publishStatus: number; // 0:成功, 1:发布中, 2:原创失败, 3:常规失败, 4:平台审核不通过, 5:成功后用户删除所有文章, 6:成功后系统封禁所有文章
}
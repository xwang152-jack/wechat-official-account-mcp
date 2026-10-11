import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WechatApiClient } from '../wechat/api-client.js';
import { AuthManager } from '../auth/auth-manager.js';
import { logger } from '../utils/logger.js';
import { wechatTools, mcpTools } from './tools/index.js';
import { PUBLIC_TOOLS, PUBLIC_ANNOTATIONS } from './public-tools.js';
import { WechatToolResult, WechatToolArgs, McpTool, McpToolAnnotations } from './types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerRequest, ServerNotification, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * 微信公众号 MCP 工具管理器
 * 负责管理和执行微信公众号相关的 MCP 工具
 */
export class WechatMcpTool {
  private apiClient: WechatApiClient;
  private authManager: AuthManager;
  private initialized = false;
  private enabledTools: string[] = [];

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
    this.apiClient = new WechatApiClient(this.authManager);
  }

  /**
   * 初始化工具
   */
  initialize(tools?: string[]): void {
    if (this.initialized) {
      return;
    }

    // 设置启用的工具列表
    if (tools && tools.length > 0) {
      this.enabledTools = tools;
    } else {
      // 默认启用全部对外工具（域工具 + 元工具 + 统计）
      this.enabledTools = PUBLIC_TOOLS.map(tool => tool.name);
    }

    this.initialized = true;
    logger.info('WechatMcpTool initialized successfully', { enabledTools: this.enabledTools });
  }

  /**
   * 获取对外暴露的工具列表
   */
  getTools(): McpTool[] {
    if (!this.initialized) {
      this.initialize();
    }
    return PUBLIC_TOOLS;
  }

  /**
   * 调用指定工具
   */
  async callTool(name: string, args: WechatToolArgs): Promise<WechatToolResult> {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.enabledTools.includes(name)) {
      throw new Error(`Tool '${name}' is not enabled`);
    }

    // 首先从mcpTools中查找
    const mcpTool = mcpTools.find(t => t.name === name);
    if (mcpTool) {
      try {
        logger.info(`Calling MCP tool: ${name}`, { args, argsType: typeof args, argsKeys: Object.keys(args || {}) });
        const result = await mcpTool.handler(args, this.apiClient);
        logger.info(`MCP Tool '${name}' executed successfully`);
        return result;
      } catch (error) {
        logger.error(`MCP Tool '${name}' execution failed:`, error);
        throw error;
      }
    }

    // 如果在mcpTools中没找到，再从wechatTools中查找（向后兼容）
    const wechatTool = wechatTools.find(t => t.name === name);
    if (wechatTool) {
      try {
        logger.info(`Calling WeChat tool: ${name}`, { args, argsType: typeof args, argsKeys: Object.keys(args || {}) });
        const result = await wechatTool.handler({
          args,
          apiClient: this.apiClient,
          authManager: this.authManager,
        });
        logger.info(`WeChat Tool '${name}' executed successfully`);
        return result;
      } catch (error) {
        logger.error(`WeChat Tool '${name}' execution failed:`, error);
        throw error;
      }
    }

    throw new Error(`Tool '${name}' not found`);
  }

  /**
   * 注册工具到MCP服务器
   */
  registerTools(server: McpServer): void {
    if (!this.initialized) {
      this.initialize();
    }

    // Register each tool individually
    const tools = this.getTools();

    // MCP SDK 1.20+ 的 registerTool 泛型会对 inputSchema 做 ShapeOutput 映射推断，
    // 而 SDK 的 AnySchema 联合了 zod v3/v4 两套类型（zod-compat），
    // 配合 McpTool.inputSchema 的宽类型声明会导致类型实例化无法收敛（TS2589）。
    // 这里用不引用 SDK 类型的窄化签名绕开泛型推断——运行时行为完全不变，
    // 参数校验仍由各工具内部的 zod schema 执行。
    const register = server.registerTool.bind(server) as (
      name: string,
      config: {
        description: string;
        inputSchema: Record<string, unknown>;
        annotations?: McpToolAnnotations;
      },
      cb: (
        params: Record<string, unknown>,
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
      ) => Promise<CallToolResult>
    ) => unknown;

    for (const tool of tools) {
      register(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
          // 注解决定 Claude 的自动授权：只读工具免逐次确认，破坏性工具必定弹确认
          annotations: PUBLIC_ANNOTATIONS[tool.name]
        },
        async (params, _extra) => {
          void _extra;
          try {
            logger.debug(`[WechatMcpTool] Calling tool: ${tool.name}`);
            logger.debug(`[WechatMcpTool] Params type: ${typeof params}`);
            logger.debug(`[WechatMcpTool] Params keys: ${Object.keys(params || {})}`);

            const result = await tool.handler(params, this.apiClient);
            logger.debug(`[WechatMcpTool] Tool ${tool.name} executed successfully`);
            return result as unknown as CallToolResult;
          } catch (error) {
            logger.error(`[WechatMcpTool] Error in tool ${tool.name}:`, error);
            // isError 必须置位，否则失败调用在协议层看起来是一次成功结果，
            // Claude 无法区分「操作成功」与「操作报错」
            return {
              isError: true,
              content: [{
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : String(error)}`
              }]
            };
          }
        }
      );
    }

    this.enabledTools = tools.map(tool => tool.name);
    logger.info(`[WechatMcpTool] Registered ${tools.length} tools to MCP server`);
  }

  /**
   * 获取认证管理器
   */
  getAuthManager(): AuthManager {
    return this.authManager;
  }

  /**
   * 获取API客户端
   */
  getApiClient(): WechatApiClient {
    return this.apiClient;
  }
}
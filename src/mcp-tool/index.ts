import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WechatApiClient } from '../wechat/api-client.js';
import { AuthManager } from '../auth/auth-manager.js';
import { logger } from '../utils/logger.js';
import { wechatTools, mcpTools } from './tools/index.js';
import { WechatToolResult, WechatToolArgs, McpTool } from './types.js';

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
      // 默认启用所有MCP工具
      this.enabledTools = mcpTools.map(tool => tool.name);
    }

    this.initialized = true;
    logger.info('WechatMcpTool initialized successfully', { enabledTools: this.enabledTools });
  }

  /**
   * 获取所有可用的工具
   */
  getTools(): McpTool[] {
    if (!this.initialized) {
      this.initialize();
    }
    return mcpTools;
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
    
    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.inputSchema
        },
        async (params: unknown) => {
          try {
            logger.debug(`[WechatMcpTool] Calling tool: ${tool.name}`);
            logger.debug(`[WechatMcpTool] Params type: ${typeof params}`);
            logger.debug(`[WechatMcpTool] Params keys: ${Object.keys(params || {})}`);
            // 不记录完整的参数内容,可能包含敏感信息
            // logger.debug(`[WechatMcpTool] Params:`, JSON.stringify(params, null, 2));

            const result = await tool.handler(params, this.apiClient);
            logger.debug(`[WechatMcpTool] Tool ${tool.name} executed successfully`);
            return result;
          } catch (error) {
            logger.error(`[WechatMcpTool] Error in tool ${tool.name}:`, error);
            return {
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
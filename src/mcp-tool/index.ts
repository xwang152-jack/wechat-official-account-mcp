import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WechatApiClient } from '../wechat/api-client.js';
import { AuthManager } from '../auth/auth-manager.js';
import { logger } from '../utils/logger.js';
import { wechatTools } from './tools/index.js';
import { WechatToolResult, WechatToolArgs } from './types.js';

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
      // 默认启用所有工具
      this.enabledTools = wechatTools.map(tool => tool.name);
    }

    this.initialized = true;
    logger.info('WechatMcpTool initialized successfully', { enabledTools: this.enabledTools });
  }

  /**
   * 获取所有可用工具
   */
  getTools(): Tool[] {
    if (!this.initialized) {
      this.initialize();
    }

    return wechatTools
      .filter(tool => this.enabledTools.includes(tool.name))
      .map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
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

    const tool = wechatTools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    try {
      logger.info(`Calling tool: ${name}`, { args });
      const result = await tool.handler({
        args,
        apiClient: this.apiClient,
        authManager: this.authManager,
      });
      logger.info(`Tool '${name}' executed successfully`);
      return result;
    } catch (error) {
      logger.error(`Tool '${name}' execution failed:`, error);
      throw error;
    }
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
          description: tool.description
          // Note: inputSchema will be handled by the MCP protocol automatically
        },
        async (args) => {
          const result = await this.callTool(tool.name, args);
          return {
            content: result.content,
            isError: result.isError
          };
        }
      );
    }

    logger.info(`Registered ${tools.length} tools to MCP server`);
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
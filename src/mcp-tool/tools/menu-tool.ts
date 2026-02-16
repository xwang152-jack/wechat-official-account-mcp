import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// 验证 Schema
const menuIdSchema = z.number().int().positive('菜单ID必须为正整数');

export const menuMcpTool: McpTool = {
  name: 'wechat_menu',
  description: '微信公众号自定义菜单管理 - 创建、查询、删除菜单，支持个性化菜单',
  inputSchema: {
    action: z.enum([
      'create',
      'get',
      'delete',
      'add_conditional',
      'delete_conditional',
      'get_selfmenu_info'
    ]),
    menuData: z.any().optional(), // 复杂的菜单结构
    menuId: menuIdSchema.optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    try {
      const validated = parseMenuParams(params);

      switch (validated.action) {
        case 'create': {
          if (!validated.menuData) {
            throw new Error('create 操作需要 menuData 参数');
          }

          await apiClient.createMenu(validated.menuData);
          return {
            content: [{
              type: 'text',
              text: `自定义菜单创建成功\n注意：菜单可能需要24小时生效，或重新关注公众号立即生效`
            }]
          };
        }

        case 'get': {
          const result = await apiClient.getMenu();
          const menuText = formatMenu(result.menu?.button || []);

          return {
            content: [{
              type: 'text',
              text: `自定义菜单配置:\n${menuText}`
            }]
          };
        }

        case 'delete': {
          await apiClient.deleteMenu();
          return {
            content: [{
              type: 'text',
              text: `自定义菜单删除成功`
            }]
          };
        }

        case 'add_conditional': {
          if (!validated.menuData) {
            throw new Error('add_conditional 操作需要 menuData 参数（需包含 button 和 matchrule）');
          }

          const result = await apiClient.addConditionalMenu(validated.menuData);
          return {
            content: [{
              type: 'text',
              text: `个性化菜单创建成功\n- 菜单ID: ${result.menuid}\n注意：个性化菜单需要一定时间生效`
            }]
          };
        }

        case 'delete_conditional': {
          if (!validated.menuId) {
            throw new Error('delete_conditional 操作需要 menuId 参数');
          }

          await apiClient.deleteConditionalMenu(validated.menuId);
          return {
            content: [{
              type: 'text',
              text: `个性化菜单删除成功\n- 菜单ID: ${validated.menuId}`
            }]
          };
        }

        case 'get_selfmenu_info': {
          const result = await apiClient.getSelfMenuInfo();
          const menuText = formatMenu(result.selfmenu_info?.button || []);

          return {
            content: [{
              type: 'text',
              text: `自定义菜单配置:\n${menuText}`
            }]
          };
        }

        default:
          throw new Error(`未知的操作: ${validated.action}`);
      }
    } catch (error) {
      logger.error('Menu tool error:', error);
      throw error;
    }
  }
};

// 格式化菜单显示
function formatMenu(buttons: Array<any>, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  return buttons.map((btn, index) => {
    let text = `${prefix}${index + 1}. ${btn.name}`;
    if (btn.type) text += ` (${btn.type})`;
    if (btn.key) text += ` [key: ${btn.key}]`;
    if (btn.url) text += ` [url: ${btn.url}]`;
    if (btn.mediaId) text += ` [mediaId: ${btn.mediaId}]`;

    if (btn.sub_button && btn.sub_button.length > 0) {
      text += '\n' + formatMenu(btn.sub_button, indent + 1);
    }

    return text;
  }).join('\n');
}

// 参数解析辅助函数
function parseMenuParams(params: unknown): any {
  return params as any;
}

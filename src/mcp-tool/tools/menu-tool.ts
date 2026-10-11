import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { jsonResult } from '../json-result.js';

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
    menuData: z.record(z.unknown()).optional(),
    menuId: menuIdSchema.optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    const validated = parseMenuParams(params);

    switch (validated.action) {
      case 'create': {
        if (!validated.menuData) {
          throw new Error('create 操作需要 menuData 参数');
        }

        await apiClient.createMenu(validated.menuData as Parameters<typeof apiClient.createMenu>[0]);
        return jsonResult({
          action: 'create',
          created: true,
          note: '菜单可能需要24小时生效，或重新关注公众号立即生效',
        });
      }

      case 'get': {
        const result = await apiClient.getMenu();
        // 按钮结构原样返回，可直接回填 create 的 menuData（含 sub_button 等原始字段）
        return jsonResult({
          action: 'get',
          buttons: result.menu?.button ?? [],
        });
      }

      case 'delete': {
        await apiClient.deleteMenu();
        return jsonResult({
          action: 'delete',
          deleted: true,
        });
      }

      case 'add_conditional': {
        if (!validated.menuData) {
          throw new Error('add_conditional 操作需要 menuData 参数（需包含 button 和 matchrule）');
        }

        const result = await apiClient.addConditionalMenu(validated.menuData as Parameters<typeof apiClient.addConditionalMenu>[0]);
        return jsonResult({
          action: 'add_conditional',
          menuId: result.menuid ?? null,
          note: '个性化菜单需要一定时间生效',
        });
      }

      case 'delete_conditional': {
        if (!validated.menuId) {
          throw new Error('delete_conditional 操作需要 menuId 参数');
        }

        await apiClient.deleteConditionalMenu(validated.menuId);
        return jsonResult({
          action: 'delete_conditional',
          menuId: validated.menuId,
          deleted: true,
        });
      }

      case 'get_selfmenu_info': {
        const result = await apiClient.getSelfMenuInfo();
        return jsonResult({
          action: 'get_selfmenu_info',
          buttons: result.selfmenu_info?.button ?? [],
        });
      }

      default:
        throw new Error(`未知的操作: ${validated.action}`);
    }
  }
};

// 参数解析辅助函数
function parseMenuParams(params: unknown) {
  return z.object({
    action: z.enum([
      'create',
      'get',
      'delete',
      'add_conditional',
      'delete_conditional',
      'get_selfmenu_info'
    ]),
    menuData: z.record(z.unknown()).optional(),
    menuId: z.number().int().positive('菜单ID必须为正整数').optional(),
  }).parse(params);
}

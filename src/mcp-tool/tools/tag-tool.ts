import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// 验证 Schema
const tagNameSchema = z.string().min(1, '标签名不能为空').max(30, '标签名不能超过30个字符');
const tagIdSchema = z.number().int().positive('标签ID必须为正整数');

export const tagMcpTool: McpTool = {
  name: 'wechat_tag',
  description: '微信公众号标签管理 - 创建、编辑、删除标签，为用户批量打标签/取消标签',
  inputSchema: {
    action: z.enum([
      'create',
      'get_list',
      'update',
      'delete',
      'batch_tagging',
      'batch_untagging',
      'get_tag_users'
    ]),
    tagName: tagNameSchema.optional(),
    tagId: tagIdSchema.optional(),
    openIdList: z.array(z.string().min(1, 'OpenID不能为空')).optional(),
    nextOpenId: z.string().optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    try {
      const validated = parseTagParams(params);

      switch (validated.action) {
        case 'create': {
          if (!validated.tagName) {
            throw new Error('create 操作需要 tagName 参数');
          }

          const result = await apiClient.createTag(validated.tagName);
          return {
            content: [{
              type: 'text',
              text: `标签创建成功\n- 标签ID: ${result.tag.id}\n- 标签名: ${result.tag.name}`
            }]
          };
        }

        case 'get_list': {
          const result = await apiClient.getTags();
          const tags = result.tags.map(tag =>
            `- ID: ${tag.id}, 名称: ${tag.name}, 用户数: ${tag.count}`
          ).join('\n');

          return {
            content: [{
              type: 'text',
              text: `标签列表 (共 ${result.tags.length} 个):\n${tags}`
            }]
          };
        }

        case 'update': {
          if (!validated.tagId) {
            throw new Error('update 操作需要 tagId 参数');
          }
          if (!validated.tagName) {
            throw new Error('update 操作需要 tagName 参数');
          }

          await apiClient.updateTag(validated.tagId, validated.tagName);
          return {
            content: [{
              type: 'text',
              text: `标签更新成功\n- 标签ID: ${validated.tagId}\n- 新名称: ${validated.tagName}`
            }]
          };
        }

        case 'delete': {
          if (!validated.tagId) {
            throw new Error('delete 操作需要 tagId 参数');
          }

          await apiClient.deleteTag(validated.tagId);
          return {
            content: [{
              type: 'text',
              text: `标签删除成功\n- 标签ID: ${validated.tagId}`
            }]
          };
        }

        case 'batch_tagging': {
          if (!validated.openIdList || validated.openIdList.length === 0) {
            throw new Error('batch_tagging 操作需要 openIdList 参数');
          }
          if (!validated.tagId) {
            throw new Error('batch_tagging 操作需要 tagId 参数');
          }

          await apiClient.batchTagging(validated.openIdList, validated.tagId);
          return {
            content: [{
              type: 'text',
              text: `批量为用户打标签成功\n- 标签ID: ${validated.tagId}\n- 用户数量: ${validated.openIdList.length}\n- 用户OpenIDs: ${validated.openIdList.join(', ')}`
            }]
          };
        }

        case 'batch_untagging': {
          if (!validated.openIdList || validated.openIdList.length === 0) {
            throw new Error('batch_untagging 操作需要 openIdList 参数');
          }
          if (!validated.tagId) {
            throw new Error('batch_untagging 操作需要 tagId 参数');
          }

          await apiClient.batchUntagging(validated.openIdList, validated.tagId);
          return {
            content: [{
              type: 'text',
              text: `批量为用户取消标签成功\n- 标签ID: ${validated.tagId}\n- 用户数量: ${validated.openIdList.length}\n- 用户OpenIDs: ${validated.openIdList.join(', ')}`
            }]
          };
        }

        case 'get_tag_users': {
          if (!validated.tagId) {
            throw new Error('get_tag_users 操作需要 tagId 参数');
          }

          const result = await apiClient.getTagUsers(String(validated.tagId), validated.nextOpenId);
          return {
            content: [{
              type: 'text',
              text: `标签下的用户列表:\n` +
                    `- 标签ID: ${validated.tagId}\n` +
                    `- 用户数量: ${result.count}\n` +
                    `- 用户OpenIDs: ${result.data.openid.join(', ')}\n` +
                    `${result.next_openid ? `- 下一页起始ID: ${result.next_openid}` : ''}`
            }]
          };
        }

        default:
          throw new Error(`未知的操作: ${validated.action}`);
      }
    } catch (error) {
      logger.error('Tag tool error:', error);
      throw error;
    }
  }
};

// 参数解析辅助函数
function parseTagParams(params: unknown): any {
  return params as any;
}

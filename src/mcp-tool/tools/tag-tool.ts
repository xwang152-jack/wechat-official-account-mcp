import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { jsonResult } from '../json-result.js';

// 验证 Schema
const tagNameSchema = z.string().min(1, '标签名不能为空').max(30, '标签名不能超过30个字符');
const tagIdSchema = z.number().int().positive('标签ID必须为正整数');

// 标签工具参数 Schema
const tagToolSchema = z.object({
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
});

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
    const validated = tagToolSchema.parse(params);

    switch (validated.action) {
      case 'create': {
        if (!validated.tagName) {
          throw new Error('create 操作需要 tagName 参数');
        }

        const result = await apiClient.createTag(validated.tagName);
        return jsonResult({
          action: 'create',
          tagId: result.tag.id,
          tagName: result.tag.name,
        });
      }

      case 'get_list': {
        const result = await apiClient.getTags();
        const tags = result.tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          count: tag.count,
        }));

        return jsonResult({
          action: 'get_list',
          count: tags.length,
          total: tags.length,
          tags,
        });
      }

      case 'update': {
        if (!validated.tagId) {
          throw new Error('update 操作需要 tagId 参数');
        }
        if (!validated.tagName) {
          throw new Error('update 操作需要 tagName 参数');
        }

        await apiClient.updateTag(validated.tagId, validated.tagName);
        return jsonResult({
          action: 'update',
          tagId: validated.tagId,
          tagName: validated.tagName,
        });
      }

      case 'delete': {
        if (!validated.tagId) {
          throw new Error('delete 操作需要 tagId 参数');
        }

        await apiClient.deleteTag(validated.tagId);
        return jsonResult({
          action: 'delete',
          tagId: validated.tagId,
        });
      }

      case 'batch_tagging': {
        if (!validated.openIdList || validated.openIdList.length === 0) {
          throw new Error('batch_tagging 操作需要 openIdList 参数');
        }
        if (!validated.tagId) {
          throw new Error('batch_tagging 操作需要 tagId 参数');
        }

        await apiClient.batchTagging(validated.openIdList, validated.tagId);
        return jsonResult({
          action: 'batch_tagging',
          tagId: validated.tagId,
          count: validated.openIdList.length,
          openids: validated.openIdList,
        });
      }

      case 'batch_untagging': {
        if (!validated.openIdList || validated.openIdList.length === 0) {
          throw new Error('batch_untagging 操作需要 openIdList 参数');
        }
        if (!validated.tagId) {
          throw new Error('batch_untagging 操作需要 tagId 参数');
        }

        await apiClient.batchUntagging(validated.openIdList, validated.tagId);
        return jsonResult({
          action: 'batch_untagging',
          tagId: validated.tagId,
          count: validated.openIdList.length,
          openids: validated.openIdList,
        });
      }

      case 'get_tag_users': {
        if (!validated.tagId) {
          throw new Error('get_tag_users 操作需要 tagId 参数');
        }

        const result = await apiClient.getTagUsers(String(validated.tagId), validated.nextOpenId);
        return jsonResult({
          action: 'get_tag_users',
          tagId: validated.tagId,
          count: result.count,
          openids: result.data?.openid ?? [],
          nextOpenid: result.next_openid || null,
        });
      }

      default:
        throw new Error(`未知的操作: ${validated.action}`);
    }
  }
};

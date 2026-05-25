import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';

// 验证 Schema
const templateIdSchema = z.string().min(1, '模板ID不能为空');
const openIdSchema = z.string().min(1, 'OpenID不能为空');

export const templateMsgMcpTool: McpTool = {
  name: 'wechat_template_msg',
  description: '微信公众号模板消息 - 发送模板消息、管理模板、设置行业、获取行业信息',
  inputSchema: {
    action: z.enum([
      'send',
      'set_industry',
      'add_template',
      'get_all_templates',
      'delete',
      'get_industry'
    ]),
    toUser: openIdSchema.optional(),
    templateId: templateIdSchema.optional(),
    industryId1: z.string().min(1, '主行业ID不能为空').optional(),
    industryId2: z.string().min(1, '副行业ID不能为空').optional(),
    templateShortId: z.string().min(1, '模板库编号不能为空').optional(),
    url: z.string().url('URL格式不正确').optional(),
    topColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式不正确，应为#RRGGBB').optional(),
    data: z.record(z.object({
      value: z.string(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式不正确').optional()
    })).optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    const validated = parseTemplateMsgParams(params);

    switch (validated.action) {
      case 'send': {
        if (!validated.toUser) {
          throw new Error('send 操作需要 toUser 参数（接收者的OpenID）');
        }
        if (!validated.templateId) {
          throw new Error('send 操作需要 templateId 参数');
        }
        if (!validated.data || Object.keys(validated.data).length === 0) {
          throw new Error('send 操作需要 data 参数（模板数据）');
        }

        const result = await apiClient.sendTemplateMessage({
          touser: validated.toUser,
          templateId: validated.templateId,
          url: validated.url,
          topcolor: validated.topColor,
          data: validated.data as Record<string, { value: string; color?: string }>
        });

        return {
          content: [{
            type: 'text',
            text: `模板消息发送成功\n` +
                  `- 接收者: ${validated.toUser}\n` +
                  `- 模板ID: ${validated.templateId}\n` +
                  `- 消息ID: ${result.msgid}`
          }]
        };
      }

      case 'set_industry': {
        if (!validated.industryId1 || !validated.industryId2) {
          throw new Error('set_industry 操作需要 industryId1 和 industryId2 参数');
        }

        await apiClient.post('/cgi-bin/template/api_set_industry', {
          industry_id1: validated.industryId1,
          industry_id2: validated.industryId2,
        });

        return {
          content: [{
            type: 'text',
            text: `模板消息所属行业设置成功\n` +
                  `- 主行业ID: ${validated.industryId1}\n` +
                  `- 副行业ID: ${validated.industryId2}`
          }]
        };
      }

      case 'add_template': {
        if (!validated.templateShortId) {
          throw new Error('add_template 操作需要 templateShortId 参数');
        }

        const result = await apiClient.post('/cgi-bin/template/api_add_template', {
          template_id_short: validated.templateShortId,
        }) as { template_id: string };

        return {
          content: [{
            type: 'text',
            text: `模板添加成功\n` +
                  `- 模板库编号: ${validated.templateShortId}\n` +
                  `- 模板ID: ${result.template_id}`
          }]
        };
      }

      case 'get_all_templates': {
        const result = await apiClient.getAllPrivateTemplates();
        const templates = result.template_list.map((tpl, index) =>
          `${index + 1}. ${tpl.title}\n` +
          `   模板ID: ${tpl.templateId}\n` +
          `   内容: ${tpl.content}\n` +
          `   示例: ${tpl.example}\n`
        ).join('\n');

        return {
          content: [{
            type: 'text',
            text: `模板列表 (共 ${result.template_list.length} 个):\n${templates}`
          }]
        };
      }

      case 'delete': {
        if (!validated.templateId) {
          throw new Error('delete 操作需要 templateId 参数');
        }

        await apiClient.deletePrivateTemplate(validated.templateId);
        return {
          content: [{
            type: 'text',
            text: `模板删除成功\n- 模板ID: ${validated.templateId}`
          }]
        };
      }

      case 'get_industry': {
        const result = await apiClient.getTemplateIndustry();
        return {
          content: [{
            type: 'text',
            text: `账号所属行业:\n` +
                  `- 主行业: ${result.primary_industry.firstClass} - ${result.primary_industry.secondClass}\n` +
                  `- 副行业: ${result.secondary_industry.firstClass} - ${result.secondary_industry.secondClass}`
          }]
        };
      }

      default:
        throw new Error(`未知的操作: ${validated.action}`);
    }
  }
};

// 参数解析辅助函数
function parseTemplateMsgParams(params: unknown) {
  return z.object({
    action: z.enum([
      'send',
      'set_industry',
      'add_template',
      'get_all_templates',
      'delete',
      'get_industry'
    ]),
    toUser: z.string().min(1, 'OpenID不能为空').optional(),
    templateId: z.string().min(1, '模板ID不能为空').optional(),
    industryId1: z.string().min(1, '主行业ID不能为空').optional(),
    industryId2: z.string().min(1, '副行业ID不能为空').optional(),
    templateShortId: z.string().min(1, '模板库编号不能为空').optional(),
    url: z.string().url('URL格式不正确').optional(),
    topColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式不正确，应为#RRGGBB').optional(),
    data: z.record(z.object({
      value: z.string(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式不正确').optional()
    })).optional(),
  }).parse(params);
}

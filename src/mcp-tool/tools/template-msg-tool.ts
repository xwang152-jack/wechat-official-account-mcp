import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { logger } from '../../utils/logger.js';

// 验证 Schema
const templateIdSchema = z.string().min(1, '模板ID不能为空');
const openIdSchema = z.string().min(1, 'OpenID不能为空');

export const templateMsgMcpTool: McpTool = {
  name: 'wechat_template_msg',
  description: '微信公众号模板消息 - 发送模板消息、获取模板列表、删除模板、获取行业信息',
  inputSchema: {
    action: z.enum([
      'send',
      'get_all_templates',
      'delete',
      'get_industry'
    ]),
    toUser: openIdSchema.optional(),
    templateId: templateIdSchema.optional(),
    url: z.string().url('URL格式不正确').optional(),
    topColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式不正确，应为#RRGGBB').optional(),
    data: z.record(z.object({
      value: z.string(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色格式不正确').optional()
    })).optional(),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    try {
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
            data: validated.data
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
    } catch (error) {
      logger.error('Template message tool error:', error);
      throw error;
    }
  }
};

// 参数解析辅助函数
function parseTemplateMsgParams(params: unknown): any {
  return params as any;
}

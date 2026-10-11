import { z } from 'zod';
import { McpTool, WechatApiClient, WechatToolResult } from '../types.js';
import { jsonResult } from '../json-result.js';

const productCardSchema = z.object({
  action: z.literal('get_card_info'),
  productId: z.string().min(1, '商品ID不能为空'),
  articleType: z.enum(['news', 'newspic']).default('news'),
  cardType: z.number().int().min(0).max(3).default(2),
});

const CARD_TYPE_MAP: Record<number, string> = {
  0: '大卡',
  1: '小卡',
  2: '文字链接',
  3: '条卡',
};

export const productCardMcpTool: McpTool = {
  name: 'wechat_product_card',
  description:
    '微信公众号商品卡片工具 - 获取在文章中插入视频号小店商品所需的 DOM 结构与 product_key。' +
    '拿到的 DOM 可直接写入草稿正文或 productInfo.footerProductInfo 实现带货。需账号已开通带货能力。',
  inputSchema: {
    action: z.literal('get_card_info').describe('操作类型：get_card_info(获取商品卡片DOM结构)'),
    productId: z.string().describe('视频号小店商品ID'),
    articleType: z.enum(['news', 'newspic']).optional()
      .describe('文章类型：news(图文消息，支持大卡/小卡/文字链接)、newspic(图片消息，支持小卡/文字链接/条卡)，默认 news'),
    cardType: z.number().optional().describe('卡片类型：0大卡、1小卡、2文字链接(默认)、3条卡'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
    const validated = productCardSchema.parse(params);

    const result = await apiClient.getProductCardInfo(
      validated.productId,
      validated.articleType,
      validated.cardType
    );

    return jsonResult({
      action: 'get_card_info',
      productId: validated.productId,
      articleType: validated.articleType,
      cardType: validated.cardType,
      cardTypeName: CARD_TYPE_MAP[validated.cardType] ?? null,
      productKey: result.productKey || null,
      dom: result.DOM || null,
      usage:
        '将 DOM 插入草稿正文即完成文中带货；或把 productKey 填入 ' +
        'wechat_draft 的 articles[].productInfo.footerProductInfo.productKey 实现文末带货。',
    });
  },
};

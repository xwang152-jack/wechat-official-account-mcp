import { WechatToolDefinition, McpTool, McpToolAnnotations } from '../types.js';
import { authTool, authMcpTool } from './auth-tool.js';
import { mediaUploadTool } from './media-upload-tool.js';
import { uploadImgTool } from './upload-img-tool.js';
import { permanentMediaTool } from './permanent-media-tool.js';
import { draftTool, draftMcpTool } from './draft-tool.js';
import { publishTool, publishMcpTool } from './publish-tool.js';
import { userMcpTool } from './user-tool.js';
import { tagMcpTool } from './tag-tool.js';
import { menuMcpTool } from './menu-tool.js';
import { templateMsgMcpTool } from './template-msg-tool.js';
import { customerServiceMcpTool } from './customer-service-tool.js';
import { statisticsMcpTool } from './statistics-tool.js';
import { autoReplyMcpTool } from './auto-reply-tool.js';
import { massSendMcpTool } from './mass-send-tool.js';
import { subscribeMsgMcpTool } from './subscribe-msg-tool.js';
import { qrcodeMcpTool } from './qrcode-tool.js';
import { shortUrlMcpTool } from './short-url-tool.js';
import { commentMcpTool } from './comment-tool.js';
import { blacklistMcpTool } from './blacklist-tool.js';
import { kfAccountMcpTool } from './kf-account-tool.js';
import { accountMcpTool } from './account-tool.js';
import { productCardMcpTool } from './product-card-tool.js';

/**
 * 所有微信公众号 MCP 工具
 */
export const wechatTools: WechatToolDefinition[] = [
  authTool,
  draftTool,
  publishTool,
];

/**
 * MCP工具列表
 */
export const mcpTools: McpTool[] = [
  // 基础功能
  authMcpTool,
  draftMcpTool,
  publishMcpTool,
  permanentMediaTool,
  mediaUploadTool,
  uploadImgTool,

  // 用户管理
  userMcpTool,

  // 标签管理
  tagMcpTool,

  // 菜单管理
  menuMcpTool,

  // 消息功能
  templateMsgMcpTool,
  customerServiceMcpTool,
  subscribeMsgMcpTool,

  // 数据分析
  statisticsMcpTool,

  // 高级功能
  autoReplyMcpTool,
  massSendMcpTool,

  // 新增工具
  qrcodeMcpTool,
  shortUrlMcpTool,
  commentMcpTool,
  blacklistMcpTool,
  kfAccountMcpTool,
  accountMcpTool,
  productCardMcpTool,
];

/**
 * 工具注解表
 *
 * 集中维护的理由：本项目多数工具采用「一个工具 + action 枚举」的复用模式，
 * 单个工具内既有只读 action 又有破坏性 action（如 wechat_draft 同时含
 * get/list/count 与 add/update/delete）。此时注解只能取保守值
 * （readOnlyHint=false + destructiveHint=true），是「读写未拆分」的直接代价。
 *
 * 判定口径：
 *  - readOnlyHint: 工具不修改任何远端数据
 *  - destructiveHint: 工具能删除或覆盖已有远端内容（区别于纯新增）
 *
 * 新增工具时必须在此登记，`npm test` 会校验覆盖完整性。
 */
export const TOOL_ANNOTATIONS: Record<string, McpToolAnnotations> = {
  wechat_auth: { title: '微信公众号认证配置', readOnlyHint: false, destructiveHint: false },
  wechat_draft: { title: '草稿管理', readOnlyHint: false, destructiveHint: true },
  wechat_publish: { title: '文章发布（freepublish）', readOnlyHint: false, destructiveHint: true },
  wechat_permanent_media: { title: '永久素材管理', readOnlyHint: false, destructiveHint: true },
  wechat_media_upload: { title: '临时素材上传', readOnlyHint: false, destructiveHint: false },
  wechat_upload_img: { title: '图文消息内图片上传', readOnlyHint: false, destructiveHint: false },
  wechat_user: { title: '用户管理', readOnlyHint: false, destructiveHint: false },
  wechat_tag: { title: '用户标签管理', readOnlyHint: false, destructiveHint: true },
  wechat_menu: { title: '自定义菜单管理', readOnlyHint: false, destructiveHint: true },
  wechat_template_msg: { title: '模板消息', readOnlyHint: false, destructiveHint: true },
  wechat_customer_service: { title: '客服消息', readOnlyHint: false, destructiveHint: false },
  wechat_subscribe_msg: { title: '一次性订阅通知', readOnlyHint: false, destructiveHint: false },
  wechat_statistics: { title: '数据统计分析', readOnlyHint: true, destructiveHint: false },
  wechat_auto_reply: { title: '自动回复规则查询', readOnlyHint: true, destructiveHint: false },
  wechat_mass_send: { title: '群发消息', readOnlyHint: false, destructiveHint: true },
  wechat_qrcode: { title: '二维码管理', readOnlyHint: false, destructiveHint: false },
  wechat_short_url: { title: '长信息与短 key 互转', readOnlyHint: false, destructiveHint: false },
  wechat_comment: { title: '文章评论管理', readOnlyHint: false, destructiveHint: true },
  wechat_blacklist: { title: '黑名单管理', readOnlyHint: false, destructiveHint: false },
  wechat_kf_account: { title: '客服账号管理', readOnlyHint: false, destructiveHint: true },
  wechat_account: { title: '账号与接口管理', readOnlyHint: false, destructiveHint: false },
  wechat_product_card: { title: '商品卡片 DOM 获取', readOnlyHint: true, destructiveHint: false },
};

export {
  authTool,
  mediaUploadTool,
  uploadImgTool,
  permanentMediaTool,
  draftTool,
  publishTool,
  userMcpTool,
  tagMcpTool,
  menuMcpTool,
  templateMsgMcpTool,
  customerServiceMcpTool,
  statisticsMcpTool,
  autoReplyMcpTool,
  massSendMcpTool,
  subscribeMsgMcpTool,
  qrcodeMcpTool,
  shortUrlMcpTool,
  commentMcpTool,
  blacklistMcpTool,
  kfAccountMcpTool,
  accountMcpTool,
  productCardMcpTool,
};
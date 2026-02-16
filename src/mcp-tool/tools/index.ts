import { WechatToolDefinition, McpTool } from '../types.js';
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
];

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
};
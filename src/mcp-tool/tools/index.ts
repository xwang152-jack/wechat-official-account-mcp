import { WechatToolDefinition, McpTool } from '../types.js';
import { authTool, authMcpTool } from './auth-tool.js';
import { mediaUploadTool } from './media-upload-tool.js';
import { uploadImgTool } from './upload-img-tool.js';
import { permanentMediaTool } from './permanent-media-tool.js';
import { draftTool, draftMcpTool } from './draft-tool.js';
import { publishTool, publishMcpTool } from './publish-tool.js';

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
  authMcpTool,
  draftMcpTool,
  publishMcpTool,
  permanentMediaTool,
  mediaUploadTool,
  uploadImgTool,
];

export {
  authTool,
  mediaUploadTool,
  uploadImgTool,
  permanentMediaTool,
  draftTool,
  publishTool,
};
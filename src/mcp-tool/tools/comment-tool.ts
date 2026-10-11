import { z } from 'zod';
import { McpTool } from '../types.js';
import { WechatApiClient } from '../../wechat/api-client.js';
import { jsonResult } from '../json-result.js';

const commentToolSchema = z.object({
  action: z.enum(['open', 'close', 'list', 'mark_elect', 'unmark_elect', 'delete', 'reply', 'delete_reply']),
  msgDataId: z.number().describe('群发消息的数据ID（msg_data_id）'),
  index: z.number().default(0).describe('多图文中的文章索引（从0开始）'),
  userCommentId: z.number().optional().describe('评论ID'),
  begin: z.number().optional().describe('评论列表起始位置'),
  count: z.number().optional().describe('评论列表获取数量（最大50）'),
  type: z.number().optional().describe('评论类型：0-全部, 1-普通评论, 2-精选评论'),
  content: z.string().optional().describe('回复内容'),
  replyId: z.number().optional().describe('回复ID'),
});

export const commentMcpTool: McpTool = {
  name: 'wechat_comment',
  description: '微信公众号评论管理工具。管理已群发文章的评论，包括打开/关闭评论、查看评论列表、精选/删除/回复评论。',
  inputSchema: {
    action: z.enum(['open', 'close', 'list', 'mark_elect', 'unmark_elect', 'delete', 'reply', 'delete_reply']),
    msgDataId: z.number().describe('群发消息的数据ID'),
    index: z.number().default(0).describe('多图文中的文章索引'),
    userCommentId: z.number().optional().describe('评论ID'),
    begin: z.number().optional().describe('评论列表起始位置'),
    count: z.number().optional().describe('获取数量（最大50）'),
    type: z.number().optional().describe('评论类型：0-全部, 1-普通, 2-精选'),
    content: z.string().optional().describe('回复内容'),
    replyId: z.number().optional().describe('回复ID'),
  },
  handler: async (params: unknown, apiClient: WechatApiClient) => {
    const args = commentToolSchema.parse(params);
    const idx = args.index ?? 0;

    switch (args.action) {
      case 'open': {
        await apiClient.openComment(args.msgDataId, idx);
        return jsonResult({ action: 'open', msgDataId: args.msgDataId, index: idx });
      }
      case 'close': {
        await apiClient.closeComment(args.msgDataId, idx);
        return jsonResult({ action: 'close', msgDataId: args.msgDataId, index: idx });
      }
      case 'list': {
        const result = await apiClient.getCommentList(
          args.msgDataId, idx,
          args.begin ?? 0,
          args.count ?? 50,
          args.type ?? 0,
        );
        const comments = result.comment.map(c => ({
          userCommentId: c.userCommentId,
          content: c.content,
          commentType: c.commentType,
          openid: c.openid ?? null,
          createTime: c.createTime,
          reply: c.reply ? { content: c.reply.content, createTime: c.reply.createTime } : null,
        }));
        return jsonResult({
          action: 'list',
          msgDataId: args.msgDataId,
          index: idx,
          total: result.total,
          count: comments.length,
          begin: args.begin ?? 0,
          comments,
        });
      }
      case 'mark_elect': {
        if (!args.userCommentId) throw new Error('精选评论需要提供 userCommentId');
        await apiClient.markElectComment(args.msgDataId, idx, args.userCommentId);
        return jsonResult({ action: 'mark_elect', msgDataId: args.msgDataId, index: idx, userCommentId: args.userCommentId });
      }
      case 'unmark_elect': {
        if (!args.userCommentId) throw new Error('取消精选需要提供 userCommentId');
        await apiClient.unmarkElectComment(args.msgDataId, idx, args.userCommentId);
        return jsonResult({ action: 'unmark_elect', msgDataId: args.msgDataId, index: idx, userCommentId: args.userCommentId });
      }
      case 'delete': {
        if (!args.userCommentId) throw new Error('删除评论需要提供 userCommentId');
        await apiClient.deleteComment(args.msgDataId, idx, args.userCommentId);
        return jsonResult({ action: 'delete', msgDataId: args.msgDataId, index: idx, userCommentId: args.userCommentId });
      }
      case 'reply': {
        if (!args.userCommentId) throw new Error('回复评论需要提供 userCommentId');
        if (!args.content) throw new Error('回复评论需要提供 content');
        await apiClient.replyComment(args.msgDataId, idx, args.userCommentId, args.content);
        return jsonResult({ action: 'reply', msgDataId: args.msgDataId, index: idx, userCommentId: args.userCommentId, content: args.content });
      }
      case 'delete_reply': {
        if (!args.userCommentId) throw new Error('删除回复需要提供 userCommentId');
        if (!args.replyId) throw new Error('删除回复需要提供 replyId');
        await apiClient.deleteCommentReply(args.msgDataId, idx, args.userCommentId, args.replyId);
        return jsonResult({ action: 'delete_reply', msgDataId: args.msgDataId, index: idx, userCommentId: args.userCommentId, replyId: args.replyId });
      }
      default:
        throw new Error(`不支持的操作: ${args.action}`);
    }
  },
};

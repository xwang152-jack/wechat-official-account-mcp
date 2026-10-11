import { McpTool, WechatApiClient, WechatToolResult } from './types.js';
import { mcpTools } from './tools/index.js';

/**
 * 动作模式
 *  r = 只读，不修改远端任何数据
 *  w = 写入，但只做新增（可重复调用不产生破坏）
 *  d = 破坏性，会删除或覆盖已有远端内容
 */
export type ActionMode = 'r' | 'w' | 'd';

export interface ActionSpec {
  /** 全局唯一动作 ID，形如 `wechat_draft.add` */
  id: string;
  /** 所属工具（对应 mcpTools 中的 name） */
  tool: string;
  /** 工具内的 action 值；单操作工具为 null */
  action: string | null;
  mode: ActionMode;
  /** 供 search_actions 检索的一句话说明 */
  summary: string;
}

/**
 * 动作目录
 *
 * 这是读写分离的事实来源：每个 action 的模式在此声明一次，
 * 拆分后的工具注解、search_actions 检索、execute_*_action 的权限校验都由此派生。
 * 数据对照微信官方服务端 API 文档，新增 action 必须在此登记（`npm test` 会校验覆盖完整性）。
 */
const SPECS: Array<[string, string | null, ActionMode, string]> = [
  // ── 认证与账号 ──────────────────────────────────────────────
  ['wechat_auth', 'configure', 'w', '配置公众号 appId 与 appSecret'],
  ['wechat_auth', 'get_token', 'r', '获取当前 Access Token（自动刷新）'],
  ['wechat_auth', 'refresh_token', 'w', '强制刷新 Access Token'],
  ['wechat_auth', 'get_config', 'r', '查看当前认证配置'],
  ['wechat_account', 'get_quota', 'r', '查询指定接口的每日调用额度与剩余次数'],
  ['wechat_account', 'get_rid_info', 'r', '用接口报错返回的 rid 查询请求/响应详情，定位故障'],
  ['wechat_account', 'get_api_domain_ip', 'r', '获取微信 API 服务器 IP 列表'],
  ['wechat_account', 'clear_quota', 'd', '重置全部接口的每日调用次数'],
  ['wechat_account', 'clear_api_quota', 'd', '重置指定接口的每日调用次数'],
  ['wechat_account', 'change_openid', 'd', '账号迁移后把旧 AppID 的 openid 转换为新 AppID 的 openid'],

  // ── 草稿 ──────────────────────────────────────────────────
  ['wechat_draft', 'add', 'w', '新建草稿，支持图文消息(news)与图片消息(newspic)'],
  ['wechat_draft', 'get', 'r', '获取草稿详情'],
  ['wechat_draft', 'list', 'r', '获取草稿列表（分页）'],
  ['wechat_draft', 'count', 'r', '获取草稿总数'],
  ['wechat_draft', 'update', 'd', '按索引更新草稿中的指定文章（覆盖原内容）'],
  ['wechat_draft', 'delete', 'd', '删除草稿'],

  // ── 发布 ──────────────────────────────────────────────────
  ['wechat_publish', 'submit', 'w', '将草稿提交发布（异步，需轮询状态）'],
  ['wechat_publish', 'get', 'r', '查询发布任务状态与详情'],
  ['wechat_publish', 'list', 'r', '获取已成功发布的消息列表'],
  ['wechat_publish', 'delete', 'd', '删除已发布文章，操作不可逆'],

  // ── 素材 ──────────────────────────────────────────────────
  ['wechat_permanent_media', 'add', 'w', '新增永久素材（图片/语音/视频/图文）'],
  ['wechat_permanent_media', 'get', 'r', '获取永久素材详情'],
  ['wechat_permanent_media', 'list', 'r', '分类型获取永久素材列表'],
  ['wechat_permanent_media', 'count', 'r', '获取永久素材总数，用于判断配额占用'],
  ['wechat_permanent_media', 'update', 'd', '按索引更新永久图文素材中的指定文章'],
  ['wechat_permanent_media', 'delete', 'd', '删除永久素材'],
  ['wechat_media_upload', 'upload', 'w', '上传临时素材（图片/语音/视频/缩略图），3 天后失效'],
  ['wechat_media_upload', 'get', 'r', '获取临时素材'],
  ['wechat_media_upload', 'list', 'r', '列出已上传的临时素材'],
  ['wechat_upload_img', null, 'w', '上传图文消息内所需图片，不占用素材库配额'],

  // ── 用户与标签 ────────────────────────────────────────────
  ['wechat_user', 'get_user_list', 'r', '获取关注者 OpenID 列表（分页）'],
  ['wechat_user', 'get_user_info', 'r', '获取单个用户的基本信息'],
  ['wechat_user', 'batch_get_user_info', 'r', '批量获取用户基本信息（最多 100 个）'],
  ['wechat_user', 'get_user_summary', 'r', '获取用户增减数据（关注/取关）'],
  ['wechat_user', 'get_user_cumulate', 'r', '获取累计用户数据'],
  ['wechat_user', 'set_remark', 'd', '设置用户备注名（覆盖原有备注）'],
  ['wechat_tag', 'create', 'w', '创建用户标签'],
  ['wechat_tag', 'get_list', 'r', '获取全部标签列表'],
  ['wechat_tag', 'get_tag_users', 'r', '获取标签下的粉丝列表'],
  ['wechat_tag', 'update', 'd', '修改标签名称'],
  ['wechat_tag', 'delete', 'd', '删除标签'],
  ['wechat_tag', 'batch_tagging', 'w', '批量为用户打标签'],
  ['wechat_tag', 'batch_untagging', 'd', '批量为用户取消标签'],
  ['wechat_blacklist', 'get_list', 'r', '获取黑名单列表'],
  ['wechat_blacklist', 'block', 'w', '拉黑用户，被拉黑者收不到公众号消息'],
  ['wechat_blacklist', 'unblock', 'd', '取消拉黑用户'],

  // ── 菜单与消息 ────────────────────────────────────────────
  ['wechat_menu', 'create', 'w', '创建自定义菜单'],
  ['wechat_menu', 'get', 'r', '获取自定义菜单配置'],
  ['wechat_menu', 'get_selfmenu_info', 'r', '查询当前生效的菜单信息'],
  ['wechat_menu', 'delete', 'd', '删除自定义菜单'],
  ['wechat_menu', 'add_conditional', 'w', '创建个性化菜单（按用户群体展示不同菜单）'],
  ['wechat_menu', 'delete_conditional', 'd', '删除个性化菜单'],
  ['wechat_template_msg', 'send', 'w', '发送模板消息给指定用户'],
  ['wechat_template_msg', 'get_all_templates', 'r', '获取账号下已选用的模板列表'],
  ['wechat_template_msg', 'get_industry', 'r', '获取账号所属行业信息'],
  ['wechat_template_msg', 'add_template', 'w', '从模板库选用模板并获得模板 ID'],
  ['wechat_template_msg', 'set_industry', 'd', '设置账号所属行业，会删除原行业下已添加的模板'],
  ['wechat_template_msg', 'delete', 'd', '删除账号下的指定模板'],
  ['wechat_customer_service', 'get_records', 'r', '获取客服聊天记录'],
  ['wechat_customer_service', 'send_text', 'w', '发送客服文本消息'],
  ['wechat_customer_service', 'send_image', 'w', '发送客服图片消息'],
  ['wechat_customer_service', 'send_voice', 'w', '发送客服语音消息'],
  ['wechat_customer_service', 'send_video', 'w', '发送客服视频消息'],
  ['wechat_customer_service', 'send_music', 'w', '发送客服音乐消息'],
  ['wechat_customer_service', 'send_news', 'w', '发送客服图文消息'],
  ['wechat_customer_service', 'send_mpnews', 'w', '发送客服图文素材消息'],
  ['wechat_subscribe_msg', 'send', 'w', '发送一次性订阅通知给授权用户'],
  ['wechat_mass_send', 'send_by_tag', 'w', '按标签群发消息'],
  ['wechat_mass_send', 'send_by_openid', 'w', '按 OpenID 列表群发消息'],
  ['wechat_mass_send', 'preview', 'r', '预览群发消息（发给指定用户查看样式）'],
  ['wechat_mass_send', 'delete', 'd', '删除群发消息'],
  ['wechat_auto_reply', 'get_current_info', 'r', '查询当前自动回复规则（关注回复、消息回复、关键词回复）'],
  ['wechat_kf_account', 'get_list', 'r', '获取客服账号列表'],
  ['wechat_kf_account', 'add', 'w', '添加客服账号'],
  ['wechat_kf_account', 'update', 'd', '修改客服账号信息'],
  ['wechat_kf_account', 'delete', 'd', '删除客服账号'],

  // ── 互动 ──────────────────────────────────────────────────
  ['wechat_comment', 'list', 'r', '查看指定文章的评论数据'],
  ['wechat_comment', 'open', 'w', '打开已群发文章的评论功能'],
  ['wechat_comment', 'close', 'd', '关闭已群发文章的评论功能'],
  ['wechat_comment', 'mark_elect', 'w', '把评论标记为精选'],
  ['wechat_comment', 'unmark_elect', 'd', '取消评论的精选标记'],
  ['wechat_comment', 'reply', 'w', '回复评论'],
  ['wechat_comment', 'delete', 'd', '删除评论'],
  ['wechat_comment', 'delete_reply', 'd', '删除评论的回复'],
  ['wechat_product_card', null, 'r', '获取视频号小店商品卡片的 DOM 结构与 product_key'],

  // ── 工具类 ────────────────────────────────────────────────
  ['wechat_qrcode', 'create_temp', 'w', '创建临时二维码（可设有效期，最长 30 天）'],
  ['wechat_qrcode', 'create_permanent', 'w', '创建永久二维码'],
  ['wechat_qrcode', 'get_url', 'r', '通过 ticket 换取二维码图片 URL'],
  ['wechat_short_url', 'generate', 'w', '长信息转短 key（不超过 4KB，需用 fetch 还原）'],
  ['wechat_short_url', 'fetch', 'r', '短 key 还原为长信息'],

  // ── 数据统计（全部只读） ──────────────────────────────────
  ['wechat_statistics', 'get_article_read', 'r', '获取发表内容每日阅读数据（含来源场景）'],
  ['wechat_statistics', 'get_article_share', 'r', '获取发表内容每日分享数据'],
  ['wechat_statistics', 'get_biz_summary', 'r', '获取发表内容概况总数据（跨度最多 30 天）'],
  ['wechat_statistics', 'get_article_total_detail', 'r', '获取发表内容详细数据（完读率、阅读时长、跳出位置）'],
  ['wechat_statistics', 'get_article_summary', 'r', '【旧接口·已停止维护】图文群发每日数据'],
  ['wechat_statistics', 'get_article_total', 'r', '【旧接口·已停止维护】图文群发总数据'],
  ['wechat_statistics', 'get_user_read', 'r', '【旧接口·已停止维护】图文阅读概况数据'],
  ['wechat_statistics', 'get_user_share', 'r', '【旧接口·已停止维护】图文分享转发数据'],
  ['wechat_statistics', 'get_upstream_message', 'r', '消息发送概况数据'],
  ['wechat_statistics', 'get_interface_summary', 'r', '接口调用分析数据'],
  ['wechat_statistics', 'get_interface_summary_hour', 'r', '接口调用分时数据'],
];

/** 动作目录（由 SPECS 展开） */
export const ACTION_CATALOG: ActionSpec[] = SPECS.map(([tool, action, mode, summary]) => ({
  id: action ? `${tool}.${action}` : tool,
  tool,
  action,
  mode,
  summary,
}));

const BY_ID = new Map(ACTION_CATALOG.map((s) => [s.id, s]));
const BY_TOOL = new Map<string, McpTool>(mcpTools.map((t) => [t.name, t]));

export function getActionSpec(id: string): ActionSpec | undefined {
  return BY_ID.get(id);
}

export function actionsOfTool(tool: string): ActionSpec[] {
  return ACTION_CATALOG.filter((s) => s.tool === tool);
}

/**
 * 按关键词检索动作。
 * 匹配范围：动作 ID、所属工具名、说明文本。中英文均可（大小写不敏感）。
 */
export function searchActions(query: string, opts: { mode?: ActionMode; limit?: number } = {}): ActionSpec[] {
  const limit = opts.limit ?? 20;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return ACTION_CATALOG
    .filter((s) => !opts.mode || s.mode === opts.mode)
    .map((s) => {
      const haystack = `${s.id} ${s.tool} ${s.summary}`.toLowerCase();
      // 全部关键词命中才算匹配（AND 语义），避免长尾噪声
      const hits = terms.filter((t) => haystack.includes(t)).length;
      return { s, hits, exact: s.id.toLowerCase() === query.toLowerCase() ? 1 : 0 };
    })
    .filter((x) => x.hits === terms.length || x.exact)
    .sort((a, b) => b.exact - a.exact || b.hits - a.hits)
    .slice(0, limit)
    .map((x) => x.s);
}

/**
 * 执行一个目录中的动作。
 *
 * 复用各工具既有的 handler：把 `{ action, ...params }` 交给所属工具，
 * 因此 108 个 action 的实现无需重写。
 *
 * @param expected 调用侧声明的预期模式，用于权限校验；
 *                 传入后若与目录登记不符直接拒绝，防止只读工具被借道执行写操作。
 */
export async function dispatchAction(
  id: string,
  params: Record<string, unknown>,
  apiClient: WechatApiClient,
  expected?: 'read' | 'write'
): Promise<WechatToolResult> {
  const spec = BY_ID.get(id);
  if (!spec) {
    throw new Error(`未知动作: ${id}`);
  }

  if (expected === 'read' && spec.mode !== 'r') {
    throw new Error(`动作 ${id} 不是只读操作（模式 ${spec.mode}），不能通过只读入口执行`);
  }
  if (expected === 'write' && spec.mode === 'r') {
    throw new Error(`动作 ${id} 是只读操作，应通过只读入口执行`);
  }

  const tool = BY_TOOL.get(spec.tool);
  if (!tool) {
    throw new Error(`动作 ${id} 所属工具 ${spec.tool} 未注册`);
  }

  const args = spec.action === null ? params : { ...params, action: spec.action };
  return tool.handler(args, apiClient);
}

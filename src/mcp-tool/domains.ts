import { z } from 'zod';
import { McpTool, McpToolAnnotations, WechatApiClient, WechatToolResult } from './types.js';
import { ACTION_CATALOG, ActionSpec, dispatchAction } from './registry.js';
import { mcpTools } from './tools/index.js';

/**
 * 高频业务域
 *
 * 抽样依据：公众号日常运营的实际动线（写稿 → 传素材 → 发布 → 回互动 → 看数据）。
 * 每个域拆成只读 / 写入两个工具，满足「读写必须分离」，同时不让工具总数失控。
 *
 * 未列入此表的长尾能力（菜单、二维码、短链、客服账号、账号配额、自动回复、
 * 商品卡片、认证配置）统一由 search_actions + execute_read_action /
 * execute_write_action 暴露。
 */
interface Domain {
  key: string;
  /** 该域覆盖的原始工具名 */
  bases: string[];
  title: string;
}

export const DOMAINS: Domain[] = [
  {
    key: 'wechat_content',
    bases: ['wechat_draft', 'wechat_publish'],
    title: '内容（草稿与发布）',
  },
  {
    key: 'wechat_media',
    bases: ['wechat_permanent_media', 'wechat_media_upload', 'wechat_upload_img'],
    title: '素材（永久/临时/图文内图片）',
  },
  {
    key: 'wechat_audience',
    bases: ['wechat_user', 'wechat_tag', 'wechat_blacklist'],
    title: '用户（粉丝、标签、黑名单）',
  },
  {
    key: 'wechat_engagement',
    bases: ['wechat_comment'],
    title: '互动（文章评论）',
  },
  {
    key: 'wechat_messaging',
    bases: ['wechat_template_msg', 'wechat_customer_service', 'wechat_subscribe_msg', 'wechat_mass_send'],
    title: '消息（模板/客服/订阅/群发）',
  },
];

const BASE_TOOL = new Map<string, McpTool>(mcpTools.map((t) => [t.name, t]));

function specsFor(domain: Domain, kind: 'read' | 'write'): ActionSpec[] {
  return ACTION_CATALOG.filter(
    (s) => domain.bases.includes(s.tool) && (kind === 'read' ? s.mode === 'r' : s.mode !== 'r')
  );
}

/** 域工具名 = `${域 key}_read` / `${域 key}_write` */
export const domainToolName = (domainKey: string, kind: 'read' | 'write') => `${domainKey}_${kind}`;

/**
 * 由动作目录生成一个域工具。
 *
 * 参数 schema 复用原工具的定义（每个参数的校验强度不退化），仅把 `action`
 * 收窄为本域本模式下的子集；执行一律经由 registry 分发，因此
 * 「只读工具被借道执行写操作」会在分发层被拒绝。
 */
function makeDomainTool(domain: Domain, kind: 'read' | 'write'): McpTool | null {
  const specs = specsFor(domain, kind);
  if (specs.length === 0) return null;

  const actions = specs.map((s) => s.action).filter((a): a is string => a !== null);
  const destructive = specs.some((s) => s.mode === 'd');

  // 合并本域各原始工具的参数定义（排除 action，由本工具收窄提供）
  const paramShapes: Record<string, z.ZodTypeAny> = {};
  for (const base of domain.bases) {
    const tool = BASE_TOOL.get(base);
    if (!tool) continue;
    for (const [k, v] of Object.entries(tool.inputSchema)) {
      if (k === 'action') continue;
      if (!(k in paramShapes)) paramShapes[k] = v as z.ZodTypeAny;
    }
  }

  const actionHint = specs.map((s) => `${s.action}(${s.summary})`).join('；');

  // 描述只陈述本工具实际能做的事，并显式指向配对工具，避免 Claude 用只读工具期待写结果
  const scopeNote = kind === 'read'
    ? `本工具只读取数据，不修改公众号上的任何内容。写入类操作请改用 ${domainToolName(domain.key, 'write')}。`
    : destructive
      ? `本工具会新增或改动公众号上的既有内容，其中删除/覆盖类操作不可逆。只读查询请改用 ${domainToolName(domain.key, 'read')}。`
      : `本工具只新增内容，不删除既有数据。只读查询请改用 ${domainToolName(domain.key, 'read')}。`;

  return {
    name: domainToolName(domain.key, kind),
    description:
      `${domain.title} —— ${kind === 'read' ? '只读查询' : '写入操作'}。${scopeNote}返回 JSON。`,
    inputSchema: {
      action: z.enum(actions as [string, ...string[]]).describe(`操作类型：${actionHint}`),
      ...paramShapes,
    },
    handler: async (params: unknown, apiClient: WechatApiClient): Promise<WechatToolResult> => {
      const { action, ...rest } = (params ?? {}) as Record<string, unknown>;
      if (typeof action !== 'string') {
        throw new Error(`${domain.key}_${kind} 需要 action 参数，可选：${actions.join(', ')}`);
      }
      const spec = ACTION_CATALOG.find((s) => s.action === action && domain.bases.includes(s.tool));
      if (!spec) {
        throw new Error(`action '${action}' 不属于 ${domain.key}，可选：${actions.join(', ')}`);
      }
      return dispatchAction(spec.id, rest, apiClient, kind === 'read' ? 'read' : 'write');
    },
  };
}

/** 生成全部域工具（只读 + 写入成对） */
export const domainTools: McpTool[] = DOMAINS
  .flatMap((d) => [makeDomainTool(d, 'read'), makeDomainTool(d, 'write')])
  .filter((t): t is McpTool => t !== null);

/** 域工具注解表，与 domainTools 一一对应 */
export const DOMAIN_ANNOTATIONS: Record<string, McpToolAnnotations> = Object.fromEntries(
  DOMAINS.flatMap((d) => {
    const out: Array<[string, McpToolAnnotations]> = [];
    for (const kind of ['read', 'write'] as const) {
      const specs = specsFor(d, kind);
      if (specs.length === 0) continue;
      out.push([
        domainToolName(d.key, kind),
        {
          title: `${d.title} · ${kind === 'read' ? '查询' : '操作'}`,
          readOnlyHint: kind === 'read',
          destructiveHint: kind === 'write' && specs.some((s) => s.mode === 'd'),
        },
      ]);
    }
    return out;
  })
);

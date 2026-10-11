import { WechatToolResult } from './types.js';

/**
 * 统一的 JSON 返回
 *
 * 所有工具的结构化输出都必须经此产出：Claude 读取的是 content[].text，
 * 返回 JSON 而非散文才能让它可靠地解析字段、复用上一轮的 ID。
 *
 * 约定：
 *  - 数据字段用 camelCase
 *  - 缺省值用 null，不要省略键
 *  - 后续调用需要的 ID 必须出现在返回中
 *  - 列表类返回必须带上用于判断是否截断的计数字段
 */
export function jsonResult(data: Record<string, unknown>): WechatToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/** 结构化的失败返回（工具内可预期失败，区别于抛异常） */
export function failureResult(message: string, detail?: Record<string, unknown>): WechatToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: message, ...detail }, null, 2) }],
  };
}

/**
 * 列表类返回请直接用 jsonResult，并带上 action 与 count/total/truncated：
 *
 *   return jsonResult({ action: 'list', count: items.length, total, truncated: total > items.length, items });
 *
 * 不提供 listResult 包装——它无法携带 action 字段，而「每个返回都含 action」
 * 是比省几行更重要的约定。
 */

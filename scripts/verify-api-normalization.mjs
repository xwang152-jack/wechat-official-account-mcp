/**
 * 微信 API 字段归一化回归检查
 *
 *   npm run build && node scripts/verify-api-normalization.mjs
 *
 * 背景：微信返回 snake_case，而本项目 TS 层用 camelCase。若某方法声明了
 * camelCase 字段却直接 `return response.data`，消费方会静默拿到 undefined
 * ——这类缺陷在本仓库曾一次性复现 15 处，且不报错、不抛异常，只能靠实际取值发现。
 *
 * 本脚本用真实的 WechatApiClient（只替换底层 httpClient）逐字段断言映射结果。
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { WechatApiClient } = await import(
  path.join(root, 'dist/src/wechat/api-client.js')
);

/** 构造一个真实客户端，仅把底层 HTTP 层替换为固定响应 */
function clientReturning(payload) {
  const c = new WechatApiClient({ getAccessToken: async () => ({ accessToken: 't' }) });
  c.httpClient = {
    get: async () => ({ data: payload }),
    post: async () => ({ data: payload }),
  };
  return c;
}

// 1. 用户列表：微信 next_openid → 工具层 nextOpenid
{
  const r = await clientReturning({
    total: 1, count: 1, data: { openid: ['o1'] }, next_openid: 'o2',
  }).getUserList();
  assert.equal(r.nextOpenid, 'o2', 'getUserList 未把 next_openid 映射为 nextOpenid');
  assert.deepEqual(r.data.openid, ['o1']);
  console.log('✓ getUserList  next_openid → nextOpenid');
}

// 2. 用户资料：headimgurl / subscribe_time / unionid / groupid / tagid_list
{
  const r = await clientReturning({
    subscribe: 1, openid: 'o', nickname: 'n', headimgurl: 'http://h',
    subscribe_time: 1700000000, unionid: 'U', groupid: 2, tagid_list: [1, 2],
  }).getUserInfo('o');
  assert.equal(r.headImgUrl, 'http://h', 'headimgurl 未映射');
  assert.equal(r.subscribeTime, 1700000000, 'subscribe_time 未映射');
  assert.equal(r.unionId, 'U', 'unionid 未映射');
  assert.equal(r.groupId, 2, 'groupid 未映射');
  assert.deepEqual(r.tagidList, [1, 2], 'tagid_list 未映射');
  console.log('✓ getUserInfo  headimgurl/subscribe_time/unionid/groupid/tagid_list');
}

// 3. 评论列表：user_comment_id / create_time / comment_type
{
  const r = await clientReturning({
    total: 1,
    comment: [{ user_comment_id: 9, create_time: 1700000000, content: 'hi', comment_type: 0, openid: 'oX' }],
  }).getCommentList(1, 0, 0, 10, 0);
  assert.equal(r.comment[0].userCommentId, 9, 'user_comment_id 未映射');
  assert.equal(r.comment[0].createTime, 1700000000, 'create_time 未映射');
  assert.equal(r.comment[0].commentType, 0, 'comment_type 未映射');
  console.log('✓ getCommentList  user_comment_id/create_time/comment_type');
}

// 4. 自动回复：字段名与微信完全不同，曾导致整个工具返回全空
{
  const r = await clientReturning({
    is_add_friend_reply: true,
    is_autoreply: true,
    add_friend_autoreply_info: { type: 'text', content: 'welcome' },
    keyword_autoreply_info: { list: [{ keyword: 'k', match_mode: 1, reply_list_info: [{ type: 'text', content: 'r' }] }] },
  }).getCurrentAutoReplyInfo();
  assert.equal(r.isAddFriendReply, true, 'is_add_friend_reply 未映射');
  assert.equal(r.isAutoReply, true, 'is_autoreply 未映射');
  assert.equal(r.addFriendReplyInfo.content, 'welcome', 'add_friend_autoreply_info 未映射');
  assert.equal(r.keywordAutoreplyInfoList[0].keyword, 'k', 'keyword_autoreply_info 未映射');
  console.log('✓ getCurrentAutoReplyInfo  is_add_friend_reply/is_autoreply/keyword_autoreply_info');
}

// 5. 模板列表与行业
{
  const tpl = await clientReturning({
    template_list: [{ template_id: 'TPL1', title: 't', content: 'c', example: 'e' }],
  }).getAllPrivateTemplates();
  assert.equal(tpl.template_list[0].templateId, 'TPL1', 'template_id 未映射');

  const ind = await clientReturning({
    primary_industry: { first_class: 'IT', second_class: '软件' },
    secondary_industry: { first_class: 'a', second_class: 'b' },
  }).getTemplateIndustry();
  assert.equal(ind.primary_industry.firstClass, 'IT', 'first_class 未映射');
  assert.equal(ind.primary_industry.secondClass, '软件', 'second_class 未映射');
  console.log('✓ getAllPrivateTemplates / getTemplateIndustry  template_id / first_class');
}

// 6. 群发：请求体必须转 snake_case，响应 msg_id 必须映射回 msgId
{
  let sentBody = null;
  const c = new WechatApiClient({ getAccessToken: async () => ({ accessToken: 't' }) });
  c.httpClient = {
    post: async (_url, body) => { sentBody = body; return { data: { errcode: 0, errmsg: 'ok', msg_id: 42, msg_data_id: 7 } }; },
  };
  const r = await c.sendMassMessageByTag({
    filter: { isToAll: false, tagId: 2 },
    msgtype: 'image',
    image: { mediaId: 'MID' },
  });
  assert.equal(sentBody.filter.is_to_all, false, 'filter.is_to_all 未转换');
  assert.equal(sentBody.filter.tag_id, 2, 'filter.tag_id 未转换');
  assert.equal(sentBody.image.media_id, 'MID', 'image.media_id 未转换');
  assert.equal(r.msgId, 42, 'msg_id 未映射为 msgId');
  assert.equal(r.msgDataId, 7, 'msg_data_id 未映射为 msgDataId');
  console.log('✓ sendMassMessageByTag  请求体 snake_case + 响应 msg_id 映射');
}

console.log('\nAPI 字段归一化检查全部通过。');

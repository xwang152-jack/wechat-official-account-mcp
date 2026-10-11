/**
 * 升级改动自检脚本（无框架依赖，直接跑 dist 产物）
 *
 *   npm run build && node scripts/verify-upgrade.mjs
 *
 * 覆盖：
 *  1. 草稿 news 字段映射
 *  2. 草稿 newspic + 商品卡 + 封面裁剪映射
 *  3. news 缺封面 / newspic 缺图片的跨字段校验
 *  4. 发表内容统计接口的「日期跨度仅 1 天」守卫
 *  5. 发布状态码映射
 */
import assert from 'node:assert/strict';

const { draftMcpTool } = await import('../dist/src/mcp-tool/tools/draft-tool.js');
const { statisticsMcpTool } = await import('../dist/src/mcp-tool/tools/statistics-tool.js');
const { publishMcpTool } = await import('../dist/src/mcp-tool/tools/publish-tool.js');

/** 记录最后一次 POST 的 fake apiClient */
function fakeClient(response = {}) {
  const calls = [];
  return {
    calls,
    post: async (path, data) => {
      calls.push({ path, data });
      return response;
    },
  };
}

// ---------- 1. news 字段映射 ----------
{
  const client = fakeClient({ media_id: 'MEDIA' });
  await draftMcpTool.handler({
    action: 'add',
    articles: [{
      title: '标题',
      content: '<p>正文</p>',
      thumbMediaId: 'THUMB',
      contentSourceUrl: 'https://example.com',
    }],
  }, client);

  const article = client.calls[0].data.articles[0];
  assert.equal(article.article_type, 'news', 'article_type 应默认为 news');
  assert.equal(article.title, '标题');
  assert.equal(article.thumb_media_id, 'THUMB');
  assert.equal(article.content_source_url, 'https://example.com');
  assert.equal(client.calls[0].path, '/cgi-bin/draft/add');
  console.log('✓ 1. news 字段映射');
}

// ---------- 2. newspic + 商品卡 + 封面裁剪 ----------
{
  const client = fakeClient({ media_id: 'MEDIA' });
  await draftMcpTool.handler({
    action: 'add',
    articles: [{
      articleType: 'newspic',
      title: '图文消息',
      content: '正文',
      imageInfo: { imageList: [{ imageMediaId: 'IMG1' }, { imageMediaId: 'IMG2' }] },
      coverInfo: { cropPercentList: [{ ratio: '1_1', x1: '0', y1: '0', x2: '1', y2: '1' }] },
      productInfo: { footerProductInfo: { productKey: 'PRODUCT_KEY' } },
    }],
  }, client);

  const article = client.calls[0].data.articles[0];
  assert.equal(article.article_type, 'newspic');
  assert.deepEqual(article.image_info, {
    image_list: [{ image_media_id: 'IMG1' }, { image_media_id: 'IMG2' }],
  });
  assert.equal(article.cover_info.crop_percent_list[0].ratio, '1_1');
  assert.deepEqual(article.product_info, {
    footer_product_info: { product_key: 'PRODUCT_KEY' },
  });
  assert.equal(article.thumb_media_id, undefined, 'newspic 不应带 thumb_media_id');
  console.log('✓ 2. newspic + 商品卡 + 封面裁剪映射');
}

// ---------- 3. 跨字段校验 ----------
{
  await assert.rejects(
    () => draftMcpTool.handler({
      action: 'add',
      articles: [{ title: 'T', content: 'C' }],
    }, fakeClient()),
    /thumbMediaId/,
    'news 缺封面应报错'
  );

  await assert.rejects(
    () => draftMcpTool.handler({
      action: 'add',
      articles: [{ articleType: 'newspic', title: 'T', content: 'C' }],
    }, fakeClient()),
    /imageInfo/,
    'newspic 缺图片应报错'
  );
  console.log('✓ 3. 跨字段校验');
}

// ---------- 4. 发表内容统计的日期跨度守卫 ----------
{
  await assert.rejects(
    () => statisticsMcpTool.handler({
      action: 'get_article_read',
      beginDate: '2026-01-01',
      endDate: '2026-01-05',
    }, fakeClient({ list: [] })),
    /仅支持查询 1 天/,
    '超过 1 天应报错'
  );

  const client = fakeClient();
  client.getArticleRead = async (beginDate, endDate) => {
    client.calls.push({ method: 'getArticleRead', beginDate, endDate });
    return { list: [], is_delay: false };
  };
  await statisticsMcpTool.handler({
    action: 'get_article_read',
    beginDate: '2026-01-01',
    endDate: '2026-01-01',
  }, client);
  assert.deepEqual(client.calls[0], {
    method: 'getArticleRead', beginDate: '2026-01-01', endDate: '2026-01-01',
  });
  console.log('✓ 4. 发表内容统计日期守卫');
}

// ---------- 5. 发布状态码映射 ----------
{
  const client = fakeClient({ publish_id: 'P1', publish_status: 1, fail_idx: [1] });
  const result = await publishMcpTool.handler({ action: 'get', publishId: 'P1' }, client);
  const text = result.content[0].text;
  assert.match(text, /发布中/, 'status=1 应为「发布中」');
  assert.doesNotMatch(text, /undefined/, '不应出现 undefined');

  const okClient = fakeClient({
    publish_id: 'P1',
    publish_status: 0,
    article_detail: { count: 1, item: [{ idx: 1, article_url: 'https://example.com/a' }] },
    fail_idx: [],
  });
  const okResult = await publishMcpTool.handler({ action: 'get', publishId: 'P1' }, okClient);
  assert.match(okResult.content[0].text, /成功/);
  assert.match(okResult.content[0].text, /https:\/\/example\.com\/a/);
  console.log('✓ 5. 发布状态码映射');
}

console.log('\n全部检查通过。');

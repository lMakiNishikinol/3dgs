const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../auth');
const store = require('../store');
const { toProductView } = require('../mappers');
const { ulid } = require('../id');

const now = () => new Date().toISOString();
const PRODUCT_STATUSES = new Set(['draft', 'submitted', 'modeling', 'ready', 'failed', 'archived']);

function validPrice(value) {
  if (value == null || value === '') return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

// 商品列表（公开 + 自己的；支持过滤）
router.get('/', optionalAuth, (req, res) => {
  const { page, pageSize, category, status, visibility } = req.query;
  let list = store.products.all();
  if (visibility === 'public') list = list.filter((p) => p.visibility === 'public');
  else if (visibility === 'private') {
    if (!req.userId) return res.err(401, 401, '登录后才能查看私有商品');
    list = list.filter((p) => p.ownerId === req.userId);
  }
  else list = list.filter((p) => p.visibility === 'public' || p.ownerId === req.userId);
  if (category) list = list.filter((p) => p.category === category);
  if (status) list = list.filter((p) => p.status === status);
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const pg = store.products.paginate(list, page, pageSize);
  return res.ok({
    items: pg.items.map(toProductView),
    page: pg.page,
    pageSize: pg.pageSize,
    total: pg.total,
    totalPages: pg.totalPages,
    hasNext: pg.hasNext,
  });
});

// 创建商品
router.post('/', auth, (req, res) => {
  const { title, description, category, sku, price, currency, coverObjectKey, attributes, visibility } =
    req.body || {};
  if (!String(title || '').trim()) return res.err(400, 400, '商品标题不能为空');
  if (!validPrice(price)) return res.err(400, 400, '商品价格必须是大于等于 0 的数字');
  if (visibility !== undefined && !['public', 'private'].includes(visibility)) {
    return res.err(400, 400, '商品可见性无效');
  }
  const rec = {
    id: ulid(),
    ownerId: req.userId,
    title: String(title).trim().slice(0, 120),
    description: description ? String(description).slice(0, 2000) : '',
    category: category || 'uncategorized',
    sku: sku || null,
    price: price != null ? Number(price) : null,
    currency: currency || 'CNY',
    coverObjectKey: coverObjectKey || null,
    attributes: attributes || {},
    visibility: visibility === 'public' ? 'public' : 'private',
    status: 'draft',
    currentModelId: null,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  store.products.insert(rec);
  return res.ok(toProductView(rec));
});

// 商品详情
router.get('/:productId', optionalAuth, (req, res) => {
  const p = store.products.findById(req.params.productId);
  if (!p) return res.err(404, 404, '商品不存在');
  if (p.visibility !== 'public' && p.ownerId !== req.userId)
    return res.err(403, 403, '无权查看该商品');
  return res.ok(toProductView(p));
});

// 更新商品
router.patch('/:productId', auth, (req, res) => {
  const p = store.products.findById(req.params.productId);
  if (!p) return res.err(404, 404, '商品不存在');
  if (p.ownerId !== req.userId) return res.err(403, 403, '无权修改该商品');
  const { title, description, category, sku, price, currency, coverObjectKey, attributes, visibility, status } =
    req.body || {};
  if (title !== undefined && !String(title).trim()) return res.err(400, 400, '商品标题不能为空');
  if (price !== undefined && !validPrice(price)) return res.err(400, 400, '商品价格必须是大于等于 0 的数字');
  if (visibility !== undefined && !['public', 'private'].includes(visibility)) return res.err(400, 400, '商品可见性无效');
  if (status !== undefined && !PRODUCT_STATUSES.has(status)) return res.err(400, 400, '商品状态无效');
  const patch = {};
  if (title !== undefined) patch.title = String(title).trim().slice(0, 120);
  if (description !== undefined) patch.description = String(description).slice(0, 2000);
  if (category !== undefined) patch.category = String(category).slice(0, 40);
  if (sku !== undefined) patch.sku = sku ? String(sku) : null;
  if (price !== undefined) patch.price = price != null ? Number(price) : null;
  if (currency !== undefined) patch.currency = String(currency).slice(0, 8);
  if (coverObjectKey !== undefined) patch.coverObjectKey = coverObjectKey || null;
  if (attributes !== undefined) patch.attributes = attributes || {};
  if (visibility !== undefined) patch.visibility = visibility === 'public' ? 'public' : 'private';
  if (status !== undefined) patch.status = status;
  patch.version = (p.version || 1) + 1;
  patch.updatedAt = now();
  store.products.update(p.id, patch);
  return res.ok(toProductView(store.products.findById(p.id)));
});

module.exports = router;

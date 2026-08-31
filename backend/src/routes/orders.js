const express = require('express');
const router = express.Router();
const { auth } = require('../auth');
const store = require('../store');
const { toOrderView } = require('../mappers');

const ORDER_STATUSES = new Set([
  'pending_payment', 'pending_production', 'processing', 'shipped',
  'completed', 'cancelled', 'refunded', 'failed',
]);

function parseStatuses(rawStatus) {
  if (rawStatus === undefined) return [];
  const values = (Array.isArray(rawStatus) ? rawStatus : [rawStatus])
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

// 我的订单列表
router.get('/', auth, (req, res) => {
  const { page, pageSize, keyword, status } = req.query;
  const statuses = parseStatuses(status);
  const invalidStatuses = statuses.filter((value) => !ORDER_STATUSES.has(value));
  if (invalidStatuses.length > 0) {
    return res.err(400, 40020, '不支持的订单状态: ' + invalidStatuses.join(', '));
  }
  let list = store.orders
    .find((o) => o.userId === req.userId)
  if (statuses.length > 0) {
    const acceptedStatuses = new Set(statuses);
    list = list.filter((order) => acceptedStatuses.has(order.status));
  }
  if (keyword) {
    const normalized = String(keyword).trim().toLowerCase();
    list = list.filter((order) =>
      [order.id, order.modelTitle, order.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const pg = store.orders.paginate(list, page, pageSize);
  return res.ok({
    items: pg.items.map(toOrderView),
    page: pg.page,
    pageSize: pg.pageSize,
    total: pg.total,
    totalPages: pg.totalPages,
    hasNext: pg.hasNext,
  });
});

router.patch('/:orderId/visibility', auth, (req, res) => {
  const order = store.orders.findById(req.params.orderId);
  if (!order) return res.err(404, 404, '订单不存在');
  if (order.userId !== req.userId) return res.err(403, 403, '无权修改');
  const updated = store.orders.update(order.id, {
    isPublic: Boolean(req.body && req.body.isPublic),
    version: (order.version || 1) + 1,
    updatedAt: new Date().toISOString(),
  });
  return res.ok(toOrderView(updated));
});

// 订单详情
router.get('/:orderId', auth, (req, res) => {
  const o = store.orders.findById(req.params.orderId);
  if (!o) return res.err(404, 404, '订单不存在');
  if (o.userId !== req.userId) return res.err(403, 403, '无权查看');
  return res.ok(toOrderView(o));
});

module.exports = router;

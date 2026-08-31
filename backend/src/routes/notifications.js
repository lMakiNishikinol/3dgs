const express = require('express');
const router = express.Router();
const { auth } = require('../auth');
const store = require('../store');
const { toNotificationView } = require('../mappers');

// 我的通知列表
router.get('/', auth, (req, res) => {
  const { page, pageSize, type } = req.query;
  let list = store.notifications.find((n) => n.userId === req.userId);
  if (type) list = list.filter((n) => n.type === type);
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const pg = store.notifications.paginate(list, page, pageSize);
  return res.ok({
    items: pg.items.map(toNotificationView),
    page: pg.page,
    pageSize: pg.pageSize,
    total: pg.total,
    totalPages: pg.totalPages,
  });
});

// 标记已读
router.patch('/:notificationId', auth, (req, res) => {
  const n = store.notifications.findById(req.params.notificationId);
  if (!n) return res.err(404, 404, '通知不存在');
  if (n.userId !== req.userId) return res.err(403, 403, '无权操作');
  const { read } = req.body || {};
  if (typeof read === 'boolean') store.notifications.update(n.id, { read });
  return res.ok(toNotificationView(store.notifications.findById(n.id)));
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../auth');
const store = require('../store');
const { toPrivateUser, toModelView, toOrderView } = require('../mappers');

const CLOSED_ORDER = ['completed', 'cancelled', 'refunded', 'failed'];

router.get('/', optionalAuth, (req, res) => {
  const me = req.userId ? store.users.findById(req.userId) : null;
  const publicReady = store.models.find(
    (m) => m.visibility === 'public' && m.status === 'ready'
  );

  const featured = publicReady.slice(0, 6).map((m) => toModelView(m, req.userId));
  const latest = publicReady.slice(0, 10).map((m) => toModelView(m, req.userId));
  const myOrders = req.userId
    ? store.orders.find((o) => o.userId === req.userId && !CLOSED_ORDER.includes(o.status)).map(toOrderView)
    : [];
  const unread = req.userId
    ? store.notifications.find((n) => n.userId === req.userId && !n.read).length
    : 0;

  return res.ok({
    currentUser: me ? toPrivateUser(me) : null,
    featuredModels: featured,
    latestModels: latest,
    activeOrders: myOrders,
    unreadNotificationCount: unread,
  });
});

module.exports = router;

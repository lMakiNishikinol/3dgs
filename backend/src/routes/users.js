const express = require('express');
const router = express.Router();
const { auth } = require('../auth');
const store = require('../store');
const { toPrivateUser, toPublicUser } = require('../mappers');

const now = () => new Date().toISOString();

router.get('/me', auth, (req, res) => {
  const user = store.users.findById(req.userId);
  if (!user) return res.err(404, 404, '用户不存在');
  return res.ok(toPrivateUser(user));
});

router.patch('/me', auth, (req, res) => {
  const user = store.users.findById(req.userId);
  if (!user) return res.err(404, 404, '用户不存在');
  const { name, company, bio, phone, email, avatarObjectKey } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = String(name).slice(0, 40);
  if (company !== undefined) patch.company = company ? String(company).slice(0, 80) : null;
  if (bio !== undefined) patch.bio = bio ? String(bio).slice(0, 200) : null;
  if (phone !== undefined) patch.phone = phone ? String(phone).slice(0, 20) : null;
  if (email !== undefined) patch.email = email ? String(email).slice(0, 120) : null;
  if (avatarObjectKey !== undefined) patch.avatarUrl = avatarObjectKey ? String(avatarObjectKey) : null;
  patch.updatedAt = now();
  patch.version = (user.version || 1) + 1;
  store.users.update(user.id, patch);
  return res.ok(toPrivateUser(store.users.findById(user.id)));
});

router.get('/:userId', (req, res) => {
  const user = store.users.findById(req.params.userId);
  if (!user) return res.err(404, 404, '用户不存在');
  return res.ok(toPublicUser(user));
});

module.exports = router;

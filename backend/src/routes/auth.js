const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { code2Session } = require('../wechat');
const { issueTokens } = require('../auth');
const store = require('../store');
const { ulid } = require('../id');
const config = require('../config');
const { ensureTestUser, verifyTestLoginKey } = require('../testAuth');

const now = () => new Date().toISOString();

// 仅本地开发联调使用；生产环境无论配置如何均不可启用。
router.post('/test/login', (req, res) => {
  if (!config.TEST_LOGIN_ENABLED) return res.err(404, 40410, '临时登录未启用');
  if (!verifyTestLoginKey(req.get('x-test-login-key'))) {
    return res.err(403, 40310, '测试登录密钥无效');
  }
  try {
    const user = ensureTestUser(req.body || {});
    return res.ok(issueTokens(user), '临时登录成功');
  } catch (error) {
    return res.err(400, 40010, error.message || '临时登录失败');
  }
});

// 微信登录：前端传 wx.login 的 code，后端换 openid 并发令牌
router.post('/wechat/login', async (req, res) => {
  try {
    const { code, profile } = req.body || {};
    if (!code) return res.err(400, 400, '缺少 wx.login code');
    const wx = await code2Session(code);
    let user = store.users.findOne((u) => u.openid === wx.openid);
    if (!user) {
      user = store.users.insert({
        id: ulid(),
        openid: wx.openid,
        unionid: wx.unionid || null,
        name: (profile && profile.name) || '微信用户',
        avatarUrl: (profile && profile.avatarUrl) || null,
        company: null,
        bio: null,
        phone: null,
        email: null,
        roles: ['user'],
        modelCount: 0,
        favoriteCount: 0,
        followingCount: 0,
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      });
    }
    return res.ok(issueTokens(user));
  } catch (e) {
    return res.err(502, 502, e.message || '微信登录失败');
  }
});

// 刷新令牌
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.err(400, 400, '缺少 refreshToken');
  jwt.verify(refreshToken, config.JWT_SECRET, (err, payload) => {
    if (err || !payload || payload.type !== 'refresh')
      return res.err(401, 401, 'refreshToken 无效或已过期');
    const user = store.users.findById(payload.sub);
    if (!user) return res.err(404, 404, '用户不存在');
    return res.ok(issueTokens(user));
  });
});

// 退出登录（无状态 JWT，前端丢弃令牌即可）
router.post('/logout', (req, res) => {
  return res.ok(null, '已退出登录');
});

module.exports = router;

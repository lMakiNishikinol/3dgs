const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../config');
const store = require('../store');
const { issueTokens } = require('../auth');
const { ensureTestUser, safeEqual } = require('../testAuth');

const router = express.Router();
const adminPage = path.join(__dirname, '..', '..', 'admin', 'index.html');
const collections = [
  'users', 'products', 'uploads', 'modelingJobs', 'models',
  'orders', 'notifications', 'favorites', 'comments',
];

function isLoopback(address) {
  return address === '127.0.0.1'
    || address === '::1'
    || address === '::ffff:127.0.0.1';
}

function isSameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === req.get('host');
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (config.ADMIN_LOCAL_BYPASS && isLoopback(req.socket.remoteAddress) && isSameOrigin(req)) return next();
  if (!config.ADMIN_TOKEN) return res.err(503, 50301, '管理令牌未配置');
  if (!safeEqual(req.get('x-admin-token'), config.ADMIN_TOKEN)) {
    return res.err(401, 40101, '管理令牌无效');
  }
  return next();
}

function countStatuses(items) {
  return items.reduce((result, item) => {
    const key = item.status || item.read || 'unknown';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function inspectDirectory(directory) {
  const result = { bytes: 0, files: 0 };
  if (!fs.existsSync(directory)) return result;
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(fullPath);
      if (entry.isFile()) {
        result.files += 1;
        result.bytes += fs.statSync(fullPath).size;
      }
    }
  }
  return result;
}

router.get('/', (_req, res) => res.sendFile(adminPage));

router.use('/api', requireAdmin);

router.get('/api/overview', (_req, res) => {
  const data = Object.fromEntries(collections.map((name) => [name, store[name].all()]));
  const storage = {
    data: inspectDirectory(path.resolve(__dirname, '..', '..', config.DATA_DIR)),
    uploads: inspectDirectory(path.join(__dirname, '..', '..', 'uploads')),
    models: inspectDirectory(path.join(__dirname, '..', '..', 'public', 'models')),
  };
  return res.ok({
    server: {
      node: process.version,
      environment: config.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
      baseUrl: config.BASE_URL,
      now: new Date().toISOString(),
    },
    counts: Object.fromEntries(collections.map((name) => [name, data[name].length])),
    statuses: {
      uploads: countStatuses(data.uploads),
      modelingJobs: countStatuses(data.modelingJobs),
      models: countStatuses(data.models),
      orders: countStatuses(data.orders),
    },
    storage,
    testLogin: {
      enabled: config.TEST_LOGIN_ENABLED,
      key: config.TEST_LOGIN_ENABLED ? config.TEST_LOGIN_KEY : '',
      endpoint: '/v1/auth/test/login',
    },
  });
});

router.get('/api/collections/:name', (req, res) => {
  const name = req.params.name;
  if (!collections.includes(name)) return res.err(404, 40401, '未知数据集合');
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const all = store[name].all();
  return res.ok({
    collection: name,
    items: all.slice(offset, offset + limit),
    total: all.length,
    offset,
    limit,
  });
});

router.post('/api/test-session', (req, res) => {
  if (!config.TEST_LOGIN_ENABLED) {
    return res.err(404, 40402, '临时登录未启用');
  }
  try {
    const user = ensureTestUser(req.body || {});
    return res.ok({ user, ...issueTokens(user) }, '测试会话已创建');
  } catch (error) {
    return res.err(400, error.code || 40002, error.message);
  }
});

module.exports = router;

const crypto = require('crypto');
const config = require('./config');
const store = require('./store');

function safeEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''), 'utf8');
  const right = Buffer.from(String(expected || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyTestLoginKey(value) {
  return config.TEST_LOGIN_ENABLED
    && Boolean(config.TEST_LOGIN_KEY)
    && safeEqual(value, config.TEST_LOGIN_KEY);
}

function normalizeUserId(value) {
  const userId = String(value || 'test-user-001').trim();
  if (!/^test-[a-zA-Z0-9_-]{1,58}$/.test(userId)) {
    const error = new Error('测试用户 ID 必须以 test- 开头，且仅包含字母、数字、下划线和短横线');
    error.code = 'INVALID_TEST_USER_ID';
    throw error;
  }
  return userId;
}

function ensureTestUser(input = {}) {
  if (!config.TEST_LOGIN_ENABLED) {
    const error = new Error('临时登录未启用');
    error.code = 'TEST_LOGIN_DISABLED';
    throw error;
  }

  const userId = normalizeUserId(input.userId);
  let user = store.users.findById(userId);
  if (user) return user;

  user = {
    id: userId,
    openid: `local-test:${userId}`,
    name: String(input.name || '本地联调用户').slice(0, 30),
    avatarUrl: null,
    company: null,
    bio: null,
    phone: '',
    email: '',
    roles: ['user'],
    modelCount: 0,
    favoriteCount: 0,
    followingCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  store.users.insert(user);
  return user;
}

module.exports = {
  ensureTestUser,
  safeEqual,
  verifyTestLoginKey,
};

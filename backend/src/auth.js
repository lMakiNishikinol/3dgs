const jwt = require('jsonwebtoken');
const config = require('./config');
const { toPrivateUser } = require('./mappers');
const store = require('./store');

function bearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : null;
}

// 必须登录：Bearer access token
function auth(req, res, next) {
  const h = req.headers.authorization;
  const token = bearerToken(h);
  if (!token) return res.err(401, 401, '未登录');
  jwt.verify(token, config.JWT_SECRET, (err, payload) => {
    if (err) return res.err(403, 403, '登录已过期，请重新登录');
    if (payload.type && payload.type !== 'access') return res.err(403, 403, '令牌类型无效');
    if (!payload.sub || !store.users.findById(payload.sub)) return res.err(401, 401, '登录用户不存在');
    req.userId = payload.sub;
    next();
  });
}

// 可选登录：带 token 就解析，不带也不拦截
function optionalAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = bearerToken(h);
  if (token) {
    try {
      const p = jwt.verify(token, config.JWT_SECRET);
      if ((!p.type || p.type === 'access') && p.sub && store.users.findById(p.sub)) req.userId = p.sub;
    } catch {
      /* ignore */
    }
  }
  next();
}

// 发放 access + refresh token
function issueTokens(user) {
  const accessToken = jwt.sign({ sub: user.id, type: 'access' }, config.JWT_SECRET, {
    expiresIn: '2h',
  });
  const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, config.JWT_SECRET, {
    expiresIn: '30d',
  });
  return {
    accessToken,
    refreshToken,
    expiresIn: 7200,
    user: toPrivateUser(user),
  };
}

module.exports = { auth, optionalAuth, issueTokens };

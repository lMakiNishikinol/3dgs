const crypto = require('crypto');

function requestId() {
  return crypto.randomUUID();
}

// 成功响应：统一包 {code, message, data, requestId}
function ok(res, data, message = 'success') {
  res.json({ code: 0, message, data, requestId: requestId() });
}

// 失败响应：code 为业务码（非 0），httpStatus 为 HTTP 状态码
function fail(res, httpStatus, code, message, data = null) {
  res.status(httpStatus).json({ code, message, data, requestId: requestId() });
}

// 给 res 挂上 res.ok / res.err 便捷方法
function responseMiddleware(req, res, next) {
  res.ok = (data, message) => ok(res, data, message);
  res.err = (httpStatus, code, message, data) => fail(res, httpStatus, code, message, data);
  next();
}

module.exports = { ok, fail, responseMiddleware, requestId };

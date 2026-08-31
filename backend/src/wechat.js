const config = require('./config');

// 用 wx.login 拿到的 code 换 openid / session_key
async function code2Session(code) {
  const url =
    `https://api.weixin.qq.com/sns/jscode2session` +
    `?appid=${encodeURIComponent(config.WECHAT_APPID)}` +
    `&secret=${encodeURIComponent(config.WECHAT_SECRET)}` +
    `&js_code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`;
  const resp = await fetch(url);
  const json = await resp.json();
  if (json.errcode) {
    throw new Error('微信登录失败: ' + (json.errmsg || json.errcode));
  }
  return json; // { openid, session_key, unionid? }
}

module.exports = { code2Session };

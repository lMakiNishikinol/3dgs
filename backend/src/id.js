// ULID 生成器（26 位，Crockford Base32，时间前缀可排序）
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function ulid() {
  const time = Date.now();
  let str = '';
  let t = time;
  for (let i = 0; i < 10; i++) {
    str = ENCODING[t % 32] + str;
    t = Math.floor(t / 32);
  }
  for (let i = 0; i < 16; i++) {
    str += ENCODING[Math.floor(Math.random() * 32)];
  }
  return str;
}

// UUID v4（用于需要标准 UUID 的字段）
function uuid() {
  return require('crypto').randomUUID();
}

module.exports = { ulid, uuid };

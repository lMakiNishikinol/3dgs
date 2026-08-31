const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const backendRoot = path.resolve(process.env.LOCAL_SETUP_ROOT || path.join(__dirname, '..'));
const envPath = path.join(backendRoot, '.env');

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return { lines: [], values: {} };
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const values = {};
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  return { lines, values };
}

function isPlaceholder(value) {
  return !value || /change|replace|placeholder|your-|example|请|填写|更换|你的/i.test(value);
}

function findLanIp() {
  const candidates = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
  return candidates.find((address) => /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(address))
    || candidates[0]
    || '127.0.0.1';
}

function randomSecret(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

function writeEnv(filePath, original, updates) {
  const seen = new Set();
  const lines = original.lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !(match[1] in updates)) return line;
    seen.add(match[1]);
    return `${match[1]}=${updates[match[1]]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${lines.filter((line, index, all) => line || index < all.length - 1).join('\r\n')}\r\n`, 'utf8');
  fs.copyFileSync(tempPath, filePath);
  fs.unlinkSync(tempPath);
}

function prepareLocalEnvironment() {
  const original = readEnv(envPath);
  const current = original.values;
  const port = /^\d+$/.test(current.PORT || '') ? current.PORT : '3000';
  const lanIp = findLanIp();
  const updates = {
    PORT: port,
    NODE_ENV: 'development',
    JWT_SECRET: isPlaceholder(current.JWT_SECRET) ? randomSecret(32) : current.JWT_SECRET,
    WECHAT_APPID: isPlaceholder(current.WECHAT_APPID) ? '' : current.WECHAT_APPID,
    WECHAT_SECRET: isPlaceholder(current.WECHAT_SECRET) ? '' : current.WECHAT_SECRET,
    PART_SIZE: current.PART_SIZE || '5242880',
    BASE_URL: `http://${lanIp}:${port}`,
    DATA_DIR: current.DATA_DIR || './data',
    ENABLE_TEST_LOGIN: 'true',
    TEST_LOGIN_KEY: isPlaceholder(current.TEST_LOGIN_KEY) ? randomSecret(16) : current.TEST_LOGIN_KEY,
    ADMIN_TOKEN: isPlaceholder(current.ADMIN_TOKEN) ? randomSecret(16) : current.ADMIN_TOKEN,
    ADMIN_LOCAL_BYPASS: current.ADMIN_LOCAL_BYPASS || 'true',
  };
  writeEnv(envPath, original, updates);

  const dataDir = path.resolve(backendRoot, updates.DATA_DIR);
  fs.mkdirSync(dataDir, { recursive: true });

  return {
    port: Number(port),
    lanIp,
    localApi: `http://127.0.0.1:${port}`,
    lanApi: `http://${lanIp}:${port}`,
    adminUrl: `http://127.0.0.1:${port}/admin`,
    testLoginKey: updates.TEST_LOGIN_KEY,
    adminToken: updates.ADMIN_TOKEN,
  };
}

if (require.main === module) {
  try {
    const result = prepareLocalEnvironment();
    console.log('');
    console.log('本地联调环境已就绪');
    console.log(`PC API:       ${result.localApi}`);
    console.log(`真机 API:     ${result.lanApi}`);
    console.log(`管理后台:     ${result.adminUrl}`);
    console.log(`测试登录密钥: ${result.testLoginKey}`);
    console.log('');
  } catch (error) {
    console.error(`本地环境初始化失败: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { findLanIp, prepareLocalEnvironment, readEnv };

require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const asBoolean = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};
const asList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

module.exports = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || '3000', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'YOUR_JWT_SECRET',
  WECHAT_APPID: process.env.WECHAT_APPID || '',
  WECHAT_SECRET: process.env.WECHAT_SECRET || '',
  PART_SIZE: parseInt(process.env.PART_SIZE || '5242880', 10),
  BASE_URL: process.env.BASE_URL || 'http://YOUR_SERVER_HOST:3000',
  DATA_DIR: process.env.DATA_DIR || './data',
  TEST_LOGIN_ENABLED: NODE_ENV !== 'production' && asBoolean(process.env.ENABLE_TEST_LOGIN),
  TEST_LOGIN_KEY: process.env.TEST_LOGIN_KEY || '',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  ADMIN_LOCAL_BYPASS: NODE_ENV !== 'production' && asBoolean(process.env.ADMIN_LOCAL_BYPASS, true),
  CORS_ORIGINS: asList(process.env.CORS_ORIGINS),
};

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config');
const { responseMiddleware } = require('./src/response');
const engine = require('./src/modeling/engine');

const app = express();

app.use(responseMiddleware);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (config.CORS_ORIGINS.includes(origin)) return callback(null, origin);
    if (config.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return callback(null, origin);
    }
    return callback(null, false);
  },
}));
app.use(express.json({ limit: '10mb' }));

// 本地管理后台：本机回环地址可直接查看，远程访问需 x-admin-token。
app.use('/admin', require('./src/routes/admin'));

// 模型文件：公开模型允许游客下载，私有模型必须由所有者携带 Bearer 令牌。
app.get('/models/:modelId/model.glb', require('./src/auth').optionalAuth, (req, res) => {
  const model = require('./src/store').models.findById(req.params.modelId);
  if (!model) return res.err(404, 404, '模型不存在');
  if (model.visibility !== 'public' && model.ownerId !== req.userId) {
    return res.err(403, 403, '无权下载该模型');
  }
  const file = path.join(__dirname, 'public', 'models', model.id, 'model.glb');
  return res.sendFile(file, (error) => {
    if (error && !res.headersSent) res.err(error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? '模型文件不存在' : '模型文件读取失败');
  });
});

// 健康检查（非 /v1）
app.use('/', require('./src/routes/health'));

// v1 业务路由
app.use('/v1/auth', require('./src/routes/auth'));
app.use('/v1/users', require('./src/routes/users'));
app.use('/v1/home', require('./src/routes/home'));
app.use('/v1/products', require('./src/routes/products'));
app.use('/v1/uploads', require('./src/routes/uploads'));
app.use('/v1/modeling-jobs', require('./src/routes/modeling'));
app.use('/v1/models', require('./src/routes/models'));
app.use('/v1/comments', require('./src/routes/comments'));
app.use('/v1/orders', require('./src/routes/orders'));
app.use('/v1/notifications', require('./src/routes/notifications'));

// 404
app.use((req, res) => res.err(404, 404, '接口不存在'));

// 全局错误处理
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400))) {
    return res.err(400, 400, '请求 JSON 格式错误');
  }
  console.error('服务器错误:', err && err.message);
  if (res.headersSent) return;
  res.err(500, 500, '服务器内部错误');
});

// 恢复未完成的建模任务（重启后不卡死）
engine.resumePendingJobs();

const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`\n  3DGS 小程序后端已启动`);
  console.log(`  本地:  http://localhost:${config.PORT}`);
  console.log(`  真机:  ${config.BASE_URL}`);
  console.log(`  后台:  http://localhost:${config.PORT}/admin`);
  console.log(`  临时登录: ${config.TEST_LOGIN_ENABLED ? '已启用（仅开发环境）' : '未启用'}\n`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${config.PORT} 已被占用，请关闭旧后端后重试。`);
    process.exit(1);
  }
  throw error;
});

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { auth } = require('../auth');
const store = require('../store');
const config = require('../config');
const { ulid } = require('../id');
const { toUploadView } = require('../mappers');
const engine = require('../modeling/engine');

const now = () => new Date().toISOString();
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// 收集原始二进制分片（不分流 JSON 解析）
function rawBody(limit) {
  return (req, res, next) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      req.rawBody = Buffer.concat(chunks);
      next();
    });
    req.on('error', next);
  };
}

// 视频上传准备
router.post('/video/prepare', auth, (req, res) => {
  const { fileName, fileSize, mimeType, durationSeconds, sha256 } = req.body || {};
  const normalizedSize = Number(fileSize);
  if (!String(fileName || '').trim() || !Number.isSafeInteger(normalizedSize) || normalizedSize <= 0) {
    return res.err(400, 400, 'fileName 不能为空，fileSize 必须是正整数');
  }
  if (durationSeconds != null && (!Number.isFinite(Number(durationSeconds)) || Number(durationSeconds) < 0)) {
    return res.err(400, 400, 'durationSeconds 必须是大于等于 0 的数字');
  }
  const uploadId = ulid();
  const totalParts = Math.max(1, Math.ceil(normalizedSize / config.PART_SIZE));
  const normalizedName = String(fileName).trim().slice(0, 200);
  const objectKey = `videos/${uploadId}/${normalizedName}`;
  const rec = {
    id: uploadId,
    ownerId: req.userId,
    status: 'prepared',
    fileName: normalizedName,
    fileSize: normalizedSize,
    mimeType: mimeType || 'video/mp4',
    durationSeconds: durationSeconds != null ? Number(durationSeconds) : null,
    sha256: sha256 || null,
    objectKey,
    partSize: config.PART_SIZE,
    totalParts,
    receivedParts: 0,
    progress: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  store.uploads.insert(rec);
  fs.mkdirSync(path.join(UPLOAD_ROOT, uploadId), { recursive: true });
  return res.ok({
    uploadId,
    objectKey,
    uploadMode: 'direct',
    partSize: config.PART_SIZE,
    totalParts,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    status: 'prepared',
  });
});

// 上传单个分片（请求体为原始字节，application/octet-stream；可选 ?sha256= 校验）
router.post(
  '/:uploadId/parts/:partNumber',
  auth,
  rawBody(config.PART_SIZE * 2),
  (req, res) => {
    const upload = store.uploads.findById(req.params.uploadId);
    if (!upload) return res.err(404, 404, '上传任务不存在');
    if (upload.ownerId !== req.userId) return res.err(403, 403, '无权操作');
    if (!['prepared', 'uploading'].includes(upload.status)) return res.err(409, 409, '当前上传状态不允许写入分片');
    const partNumber = parseInt(req.params.partNumber, 10);
    if (isNaN(partNumber) || partNumber < 1 || partNumber > upload.totalParts)
      return res.err(400, 400, '分片序号越界');
    const buf = req.rawBody;
    if (!buf || buf.length === 0) return res.err(400, 400, '分片内容为空');

    const expSha = req.query.sha256;
    const actualSha = crypto.createHash('sha256').update(buf).digest('hex');
    if (expSha && expSha !== actualSha) return res.err(400, 400, '分片校验失败');

    fs.writeFileSync(path.join(UPLOAD_ROOT, upload.id, `part_${partNumber}.bin`), buf);

    const received = fs
      .readdirSync(path.join(UPLOAD_ROOT, upload.id))
      .filter((f) => f.startsWith('part_')).length;
    const progress = Math.min(100, Math.round((received / upload.totalParts) * 100));
    store.uploads.update(upload.id, {
      status: 'uploading',
      receivedParts: received,
      progress,
      updatedAt: now(),
    });
    return res.ok({ partNumber, etag: actualSha, sha256: actualSha });
  }
);

// 视频上传完成 + 触发建模
router.post('/video/complete', auth, (req, res) => {
  const b = req.body || {};
  const { uploadId, objectKey, parts, product, modelObjectName, visibility, trainingProfile } = b;
  const upload = store.uploads.findById(uploadId);
  if (!upload) return res.err(404, 404, '上传任务不存在');
  if (upload.ownerId !== req.userId) return res.err(403, 403, '无权操作');
  if (upload.status === 'completed' && upload.productId && upload.modelId && upload.orderId && upload.jobId) {
    return res.ok({
      uploadId: upload.id,
      productId: upload.productId,
      modelId: upload.modelId,
      jobId: upload.jobId,
      orderId: upload.orderId,
      status: 'accepted',
    });
  }
  if (!['prepared', 'uploading'].includes(upload.status)) return res.err(409, 409, '当前上传状态不允许完成');

  const dir = path.join(UPLOAD_ROOT, upload.id);
  for (let i = 1; i <= upload.totalParts; i++) {
    if (!fs.existsSync(path.join(dir, `part_${i}.bin`)))
      return res.err(400, 400, `分片 ${i} 缺失`);
  }

  // 合并分片为最终视频文件（持久化到磁盘）
  const ext = (upload.fileName.split('.').pop() || 'mp4').slice(0, 10);
  const finalPath = path.join(dir, `video.${ext}`);
  const chunks = [];
  for (let i = 1; i <= upload.totalParts; i++) {
    chunks.push(fs.readFileSync(path.join(dir, `part_${i}.bin`)));
  }
  const merged = Buffer.concat(chunks);
  if (merged.length !== upload.fileSize) return res.err(400, 400, '上传文件大小与声明不一致');
  fs.writeFileSync(finalPath, merged);
  for (let i = 1; i <= upload.totalParts; i++) {
    try {
      fs.unlinkSync(path.join(dir, `part_${i}.bin`));
    } catch (_) {
      /* 清理失败不影响主流程（部分环境会拦截删除） */
    }
  }

  // 创建商品
  const pInput = product || {};
  const productId = ulid();
  const productRec = {
    id: productId,
    ownerId: req.userId,
    title: pInput.title || upload.fileName,
    description: pInput.description || '',
    category: pInput.category || 'uncategorized',
    sku: pInput.sku || null,
    price: pInput.price != null ? Number(pInput.price) : null,
    currency: pInput.currency || 'CNY',
    coverObjectKey: pInput.coverObjectKey || null,
    attributes: pInput.attributes || {},
    visibility: visibility || pInput.visibility || 'private',
    status: 'modeling',
    currentModelId: null,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  store.products.insert(productRec);

  // 创建模型
  const user = store.users.findById(req.userId);
  const modelId = ulid();
  const modelRec = {
    id: modelId,
    productId,
    ownerId: req.userId,
    title: productRec.title,
    description: productRec.description,
    ownerName: user ? user.name || '用户' : '用户',
    visibility: productRec.visibility,
    status: 'processing',
    viewerAvailable: false,
    colorSeed: Math.floor(Math.random() * 1000),
    viewCount: 0,
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  store.models.insert(modelRec);

  // 创建订单
  const orderId = ulid();
  const orderRec = {
    id: orderId,
    userId: req.userId,
    productId,
    modelId,
    jobId: null,
    modelTitle: modelRec.title,
    description: modelRec.description,
    status: 'pending_payment',
    modelStatus: 'processing',
    viewerAvailable: false,
    progress: 0,
    originalAmount: 0,
    discountAmount: 0,
    paidAmount: 0,
    currency: productRec.currency,
    isPublic: productRec.visibility === 'public',
    version: 1,
    createdAt: now(),
    updatedAt: now(),
  };
  store.orders.insert(orderRec);

  // 创建建模任务并启动（当前为模拟流水线，后续接 AutoDL）
  const jobId = ulid();
  const jobRec = {
    id: jobId,
    userId: req.userId,
    uploadId: upload.id,
    productId,
    orderId,
    modelId,
    providerJobId: null,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    attempt: 1,
    maxAttempts: 3,
    algorithmVersion: '3dgs-1.0',
    errorCode: null,
    errorMessage: null,
    createdAt: now(),
    updatedAt: now(),
  };
  store.modelingJobs.insert(jobRec);
  store.orders.update(orderId, { jobId });
  store.uploads.update(upload.id, {
    status: 'completed',
    progress: 100,
    productId,
    modelId,
    orderId,
    jobId,
    updatedAt: now(),
  });

  engine.startModeling(jobRec);

  return res.ok({
    uploadId: upload.id,
    productId,
    modelId,
    jobId,
    orderId,
    status: 'accepted',
  });
});

// 上传状态
router.get('/:uploadId', auth, (req, res) => {
  const upload = store.uploads.findById(req.params.uploadId);
  if (!upload) return res.err(404, 404, '上传任务不存在');
  if (upload.ownerId !== req.userId) return res.err(403, 403, '无权操作');
  return res.ok(toUploadView(upload));
});

// 取消上传
router.delete('/:uploadId', auth, (req, res) => {
  const upload = store.uploads.findById(req.params.uploadId);
  if (!upload) return res.err(404, 404, '上传任务不存在');
  if (upload.ownerId !== req.userId) return res.err(403, 403, '无权操作');
  store.uploads.update(upload.id, { status: 'aborted', updatedAt: now() });
  return res.ok(null, '上传已取消');
});

module.exports = router;

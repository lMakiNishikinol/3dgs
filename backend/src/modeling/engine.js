const fs = require('fs');
const path = require('path');
const config = require('../config');
const store = require('../store');
const { ulid } = require('../id');

const PUBLIC_DIR = path.resolve(__dirname, '..', '..', 'public');
const MODELS_DIR = path.join(PUBLIC_DIR, 'models');
if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

const now = () => new Date().toISOString();

// 生成一个合法的低多边形立方体 GLB，供本地联调 viewer 加载。
function makeMinimalGlb() {
  const positions = new Float32Array([
    -1,-1, 1,  1,-1, 1,  1, 1, 1, -1, 1, 1,
     1,-1,-1, -1,-1,-1, -1, 1,-1,  1, 1,-1,
    -1, 1, 1,  1, 1, 1,  1, 1,-1, -1, 1,-1,
    -1,-1,-1,  1,-1,-1,  1,-1, 1, -1,-1, 1,
     1,-1, 1,  1,-1,-1,  1, 1,-1,  1, 1, 1,
    -1,-1,-1, -1,-1, 1, -1, 1, 1, -1, 1,-1,
  ]);
  const normals = new Float32Array([
     0,0,1, 0,0,1, 0,0,1, 0,0,1,  0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
     0,1,0, 0,1,0, 0,1,0, 0,1,0,  0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
     1,0,0, 1,0,0, 1,0,0, 1,0,0, -1,0,0,-1,0,0,-1,0,0,-1,0,0,
  ]);
  const uvs = new Float32Array(Array.from({ length: 6 }, () => [0,0, 1,0, 1,1, 0,1]).flat());
  const indices = new Uint16Array(Array.from({ length: 6 }, (_, face) => {
    const offset = face * 4;
    return [offset, offset + 1, offset + 2, offset, offset + 2, offset + 3];
  }).flat());
  const posBuf = Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength);
  const normalBuf = Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength);
  const uvBuf = Buffer.from(uvs.buffer, uvs.byteOffset, uvs.byteLength);
  const idxBuf = Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength);
  const bin = Buffer.concat([posBuf, normalBuf, uvBuf, idxBuf]);
  const binPadded =
    bin.length % 4 === 0 ? bin : Buffer.concat([bin, Buffer.alloc(4 - (bin.length % 4))]);

  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.42, 0.64, 0.82, 1], metallicFactor: 0.1, roughnessFactor: 0.62 } }],
    buffers: [{ byteLength: binPadded.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: posBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length, byteLength: normalBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length + normalBuf.length, byteLength: uvBuf.length, target: 34962 },
      { buffer: 0, byteOffset: posBuf.length + normalBuf.length + uvBuf.length, byteLength: idxBuf.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-1,-1,-1], max: [1,1,1] },
      { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 24, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
  };
  const jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jsonPadded =
    jsonBuf.length % 4 === 0 ? jsonBuf : Buffer.concat([jsonBuf, Buffer.alloc(4 - (jsonBuf.length % 4), 0x20)]);

  const totalLength = 12 + 8 + jsonPadded.length + 8 + binPadded.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // glTF
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // JSON

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binPadded.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // BIN

  return Buffer.concat([header, jsonChunkHeader, jsonPadded, binChunkHeader, binPadded]);
}

function ensureViewerAsset(modelId) {
  const dir = path.join(MODELS_DIR, modelId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'model.glb');
  if (!fs.existsSync(file)) fs.writeFileSync(file, makeMinimalGlb());
  return { format: 'glb', url: `/models/${modelId}/model.glb`, available: true };
}

function getViewerAsset(modelId) {
  const file = path.join(MODELS_DIR, modelId, 'model.glb');
  if (!fs.existsSync(file)) return { format: 'glb', url: null, available: false };
  return { format: 'glb', url: `/models/${modelId}/model.glb`, available: true };
}

// 模拟 3DGS 重建异步流水线：queued → preprocessing → training → converting → validating → succeeded
// 后续接 AutoDL 时，把这里换成「投递任务到 AutoDL 实例 + 回调更新状态」即可。
function startModeling(job) {
  const steps = [
    { status: 'preprocessing', stage: 'preprocessing', progress: 15, delay: 2000 },
    { status: 'training', stage: 'training', progress: 45, delay: 3000 },
    { status: 'converting', stage: 'converting', progress: 70, delay: 2500 },
    { status: 'validating', stage: 'validating', progress: 90, delay: 2000 },
  ];
  store.modelingJobs.update(job.id, { status: 'queued', stage: 'queued', progress: 0, updatedAt: now() });
  let i = 0;
  const tick = () => {
    if (i < steps.length) {
      const s = steps[i++];
      store.modelingJobs.update(job.id, {
        status: s.status,
        stage: s.stage,
        progress: s.progress,
        updatedAt: now(),
      });
      setTimeout(tick, s.delay);
    } else {
      store.modelingJobs.update(job.id, {
        status: 'succeeded',
        stage: 'succeeded',
        progress: 100,
        updatedAt: now(),
      });
      store.models.update(job.modelId, {
        status: 'ready',
        viewerAvailable: true,
        updatedAt: now(),
      });
      ensureViewerAsset(job.modelId);
      if (job.productId) {
        store.products.update(job.productId, {
          status: 'ready',
          currentModelId: job.modelId,
          updatedAt: now(),
        });
      }
      if (job.orderId) {
        store.orders.update(job.orderId, {
          modelStatus: 'ready',
          viewerAvailable: true,
          progress: 100,
          updatedAt: now(),
        });
      }
      store.notifications.insert({
        id: ulid(),
        userId: job.userId,
        type: 'modeling_succeeded',
        title: '模型已生成',
        body: '您的 3D 模型已生成完成，可在小程序中查看。',
        read: false,
        resourceType: 'model',
        resourceId: job.modelId,
        createdAt: now(),
      });
    }
  };
  setTimeout(tick, 1500);
}

// 服务重启后，恢复未完成（非终态）的建模任务，避免卡死
function resumePendingJobs() {
  const nonTerminal = ['queued', 'preprocessing', 'training', 'converting', 'validating'];
  for (const job of store.modelingJobs.find((j) => nonTerminal.includes(j.status))) {
    startModeling(job);
  }
}

module.exports = { startModeling, resumePendingJobs, getViewerAsset, ensureViewerAsset };

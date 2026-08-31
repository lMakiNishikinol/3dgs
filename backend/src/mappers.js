const store = require('./store');

function avatarSeed(user) {
  if (Number.isInteger(user.avatarSeed) && user.avatarSeed > 0) return user.avatarSeed;
  const hash = String(user.id || '').split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return (hash % 9) + 1;
}

function toPublicUser(u) {
  return {
    id: u.id,
    name: u.name || '用户',
    company: u.company || null,
    bio: u.bio || null,
    avatarUrl: u.avatarUrl || null,
    avatarSeed: avatarSeed(u),
    modelCount: u.modelCount || 0,
    favoriteCount: u.favoriteCount || 0,
    followingCount: u.followingCount || 0,
    version: u.version || 1,
  };
}

function toPrivateUser(u) {
  return Object.assign(toPublicUser(u), {
    email: u.email || null,
    roles: u.roles || ['user'],
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  });
}

function toProductView(p) {
  return {
    id: p.id,
    ownerId: p.ownerId,
    title: p.title,
    description: p.description,
    category: p.category,
    sku: p.sku || null,
    price: p.price != null ? p.price : null,
    currency: p.currency,
    coverUrl: p.coverObjectKey || null,
    attributes: p.attributes || {},
    visibility: p.visibility,
    status: p.status,
    currentModelId: p.currentModelId || null,
    version: p.version || 1,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toModelView(m, userId) {
  const favCount = store.favorites.find((f) => f.modelId === m.id).length;
  const cmtCount = store.comments.find((c) => c.modelId === m.id).length;
  const isFav = userId
    ? !!store.favorites.findOne((f) => f.modelId === m.id && f.userId === userId)
    : false;
  return {
    id: m.id,
    productId: m.productId,
    ownerId: m.ownerId,
    title: m.title,
    description: m.description,
    ownerName: m.ownerName || '',
    visibility: m.visibility,
    status: m.status,
    viewerAvailable: !!m.viewerAvailable,
    favoriteCount: favCount,
    commentCount: cmtCount,
    viewCount: m.viewCount || 0,
    isFavorite: isFav,
    colorSeed: m.colorSeed || 0,
    sourceVideoDuration: m.sourceVideoDuration != null ? m.sourceVideoDuration : 0,
    version: m.version || 1,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function toOrderView(o) {
  return {
    id: o.id,
    userId: o.userId,
    productId: o.productId,
    modelId: o.modelId,
    jobId: o.jobId,
    modelTitle: o.modelTitle,
    description: o.description,
    status: o.status,
    modelStatus: o.modelStatus,
    viewerAvailable: !!o.viewerAvailable,
    progress: o.progress || 0,
    originalAmount: o.originalAmount != null ? o.originalAmount : null,
    discountAmount: o.discountAmount != null ? o.discountAmount : null,
    paidAmount: o.paidAmount != null ? o.paidAmount : null,
    currency: o.currency,
    isPublic: !!o.isPublic,
    contactEmail: o.contactEmail || '',
    paidAt: o.paidAt || null,
    deliveredAt: o.deliveredAt || null,
    version: o.version || 1,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function toNotificationView(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: !!n.read,
    resourceType: n.resourceType || null,
    resourceId: n.resourceId || null,
    createdAt: n.createdAt,
  };
}

function toCommentView(c, userId) {
  const likedBy = Array.isArray(c.likedBy) ? [...new Set(c.likedBy)] : [];
  return {
    id: c.id,
    modelId: c.modelId,
    userId: c.userId,
    userName: c.userName,
    content: c.content,
    likeCount: likedBy.length || c.likeCount || 0,
    likedByMe: userId ? likedBy.includes(userId) : false,
    createdAt: c.createdAt,
  };
}

function toUploadView(u) {
  return {
    id: u.id,
    status: u.status,
    fileName: u.fileName,
    fileSize: u.fileSize,
    progress: u.progress || 0,
    failureCode: u.failureCode || null,
    failureMessage: u.failureMessage || null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function toJobView(j) {
  return {
    id: j.id,
    userId: j.userId,
    uploadId: j.uploadId,
    productId: j.productId,
    orderId: j.orderId,
    modelId: j.modelId,
    providerJobId: j.providerJobId || null,
    status: j.status,
    stage: j.stage,
    progress: j.progress || 0,
    attempt: j.attempt || 1,
    maxAttempts: j.maxAttempts || 3,
    algorithmVersion: j.algorithmVersion,
    errorCode: j.errorCode || null,
    errorMessage: j.errorMessage || null,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

module.exports = {
  toPublicUser,
  toPrivateUser,
  toProductView,
  toModelView,
  toOrderView,
  toNotificationView,
  toCommentView,
  toUploadView,
  toJobView,
};

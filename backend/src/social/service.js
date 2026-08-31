const store = require('../store');
const { ulid } = require('../id');
const { toCommentView } = require('../mappers');

const now = () => new Date().toISOString();

class SocialError extends Error {
  constructor(httpStatus, code, message) {
    super(message);
    this.name = 'SocialError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

function requireVisibleModel(modelId, userId) {
  const model = store.models.findById(modelId);
  if (!model) throw new SocialError(404, 40420, '模型不存在');
  if (model.visibility !== 'public' && model.ownerId !== userId) {
    throw new SocialError(403, 40320, '无权查看该模型');
  }
  return model;
}

function requireComment(commentId, userId) {
  const comment = store.comments.findById(commentId);
  if (!comment) throw new SocialError(404, 40421, '评论不存在');
  requireVisibleModel(comment.modelId, userId);
  return comment;
}

function syncFavoriteCount(userId) {
  const user = store.users.findById(userId);
  if (!user) return;
  store.users.update(userId, {
    favoriteCount: store.favorites.find((item) => item.userId === userId).length,
    updatedAt: now(),
  });
}

function favoriteModel(modelId, userId) {
  const model = requireVisibleModel(modelId, userId);
  let favorite = store.favorites.findOne((item) => item.modelId === model.id && item.userId === userId);
  if (!favorite) {
    favorite = store.favorites.insert({ id: ulid(), userId, modelId: model.id, createdAt: now() });
    syncFavoriteCount(userId);
  }
  return {
    favorited: true,
    favoriteCount: store.favorites.find((item) => item.modelId === model.id).length,
  };
}

function unfavoriteModel(modelId, userId) {
  const model = requireVisibleModel(modelId, userId);
  const favorite = store.favorites.findOne((item) => item.modelId === model.id && item.userId === userId);
  if (favorite) {
    store.favorites.remove(favorite.id);
    syncFavoriteCount(userId);
  }
  return {
    favorited: false,
    favoriteCount: store.favorites.find((item) => item.modelId === model.id).length,
  };
}

function listComments(modelId, userId, page, pageSize) {
  requireVisibleModel(modelId, userId);
  const items = store.comments
    .find((comment) => comment.modelId === modelId)
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
  const result = store.comments.paginate(items, page, pageSize);
  return {
    items: result.items.map((comment) => toCommentView(comment, userId)),
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
    hasNext: result.page < result.totalPages,
  };
}

function createComment(modelId, userId, input, idempotencyKey) {
  const model = requireVisibleModel(modelId, userId);
  const user = store.users.findById(userId);
  if (!user) throw new SocialError(401, 40120, '登录用户不存在');
  const content = String(input && input.content || '').trim();
  if (!content) throw new SocialError(422, 42220, '评论内容不能为空');
  if (content.length > 500) throw new SocialError(422, 42221, '评论内容不能超过 500 字');

  if (idempotencyKey) {
    const existing = store.comments.findOne((comment) =>
      comment.modelId === model.id
      && comment.userId === userId
      && comment.idempotencyKey === idempotencyKey
    );
    if (existing) return toCommentView(existing, userId);
  }

  const record = {
    id: ulid(),
    modelId: model.id,
    userId,
    userName: user.name || '用户',
    content,
    likedBy: [],
    likeCount: 0,
    idempotencyKey: idempotencyKey || null,
    createdAt: now(),
    updatedAt: now(),
  };
  store.comments.insert(record);
  return toCommentView(record, userId);
}

function deleteComment(commentId, userId) {
  const comment = requireComment(commentId, userId);
  if (comment.userId !== userId) throw new SocialError(403, 40321, '只能删除自己的评论');
  store.comments.remove(comment.id);
  return { deleted: true, commentId: comment.id };
}

function setCommentLike(commentId, userId, liked) {
  const comment = requireComment(commentId, userId);
  const likedBy = Array.isArray(comment.likedBy) ? [...new Set(comment.likedBy)] : [];
  const index = likedBy.indexOf(userId);
  if (liked && index < 0) likedBy.push(userId);
  if (!liked && index >= 0) likedBy.splice(index, 1);
  const updated = store.comments.update(comment.id, {
    likedBy,
    likeCount: likedBy.length,
    updatedAt: now(),
  });
  return toCommentView(updated, userId);
}

module.exports = {
  SocialError,
  createComment,
  deleteComment,
  favoriteModel,
  listComments,
  requireVisibleModel,
  setCommentLike,
  unfavoriteModel,
};

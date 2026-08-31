const express = require('express');
const { auth, optionalAuth } = require('../auth');
const store = require('../store');
const { toModelView } = require('../mappers');
const engine = require('../modeling/engine');
const social = require('../social/service');

const router = express.Router();
const now = () => new Date().toISOString();

function respond(res, action) {
  try {
    return res.ok(action());
  } catch (error) {
    if (error instanceof social.SocialError) {
      return res.err(error.httpStatus, error.code, error.message);
    }
    throw error;
  }
}

// 游客可看公开模型；登录后额外可看自己的私有模型。
router.get('/', optionalAuth, (req, res) => {
  const { page, pageSize, visibility, status, keyword, ownerId, favoriteBy, sort } = req.query;
  let list = store.models.all();

  if (visibility === 'private') {
    if (!req.userId) return res.err(401, 401, '登录后才能查看私有模型');
    list = list.filter((model) => model.ownerId === req.userId && model.visibility === 'private');
  } else if (visibility === 'public') {
    list = list.filter((model) => model.visibility === 'public');
  } else {
    list = list.filter((model) => model.visibility === 'public' || model.ownerId === req.userId);
  }

  if (ownerId) list = list.filter((model) => model.ownerId === ownerId);
  if (status) list = list.filter((model) => model.status === status);
  if (keyword) {
    const normalized = String(keyword).trim().toLowerCase();
    list = list.filter((model) =>
      [model.title, model.description, model.ownerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }
  if (favoriteBy === 'me') {
    if (!req.userId) return res.err(401, 401, '登录后才能查看收藏');
    const modelIds = new Set(store.favorites.find((favorite) => favorite.userId === req.userId).map((favorite) => favorite.modelId));
    list = list.filter((model) => modelIds.has(model.id));
  }

  if (sort === 'popular') {
    list.sort((left, right) => {
      const leftScore = (left.viewCount || 0) + store.favorites.find((item) => item.modelId === left.id).length * 5;
      const rightScore = (right.viewCount || 0) + store.favorites.find((item) => item.modelId === right.id).length * 5;
      return rightScore - leftScore;
    });
  } else {
    list.sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
  }

  const result = store.models.paginate(list, page, pageSize);
  return res.ok({
    ...result,
    items: result.items.map((model) => toModelView(model, req.userId)),
  });
});

router.get('/:modelId', optionalAuth, (req, res) =>
  respond(res, () => toModelView(social.requireVisibleModel(req.params.modelId, req.userId), req.userId))
);

router.get('/:modelId/viewer', optionalAuth, (req, res) =>
  respond(res, () => {
    const model = social.requireVisibleModel(req.params.modelId, req.userId);
    const asset = engine.getViewerAsset(model.id);
    if (!asset.available) throw new social.SocialError(409, 40920, '模型文件尚未生成');
    store.models.update(model.id, { viewCount: (model.viewCount || 0) + 1, updatedAt: now() });
    return { modelId: model.id, ...asset };
  })
);

router.patch('/:modelId', auth, (req, res) => {
  const model = store.models.findById(req.params.modelId);
  if (!model) return res.err(404, 404, '模型不存在');
  if (model.ownerId !== req.userId) return res.err(403, 403, '无权修改');
  const { title, description, visibility } = req.body || {};
  const patch = {};
  if (title !== undefined) patch.title = String(title).trim().slice(0, 120);
  if (description !== undefined) patch.description = String(description).trim().slice(0, 2000);
  if (visibility !== undefined) patch.visibility = visibility === 'public' ? 'public' : 'private';
  patch.version = (model.version || 1) + 1;
  patch.updatedAt = now();
  return res.ok(toModelView(store.models.update(model.id, patch), req.userId));
});

router.put('/:modelId/favorite', auth, (req, res) =>
  respond(res, () => social.favoriteModel(req.params.modelId, req.userId))
);

router.delete('/:modelId/favorite', auth, (req, res) =>
  respond(res, () => social.unfavoriteModel(req.params.modelId, req.userId))
);

router.get('/:modelId/comments', optionalAuth, (req, res) =>
  respond(res, () => social.listComments(
    req.params.modelId,
    req.userId,
    req.query.page,
    req.query.pageSize
  ))
);

router.post('/:modelId/comments', auth, (req, res) =>
  respond(res, () => social.createComment(
    req.params.modelId,
    req.userId,
    req.body,
    req.headers['idempotency-key']
  ))
);

module.exports = router;

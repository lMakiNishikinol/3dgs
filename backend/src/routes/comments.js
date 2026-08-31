const express = require('express');
const { auth } = require('../auth');
const social = require('../social/service');

const router = express.Router();

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

router.delete('/:commentId', auth, (req, res) =>
  respond(res, () => social.deleteComment(req.params.commentId, req.userId))
);

router.put('/:commentId/like', auth, (req, res) =>
  respond(res, () => social.setCommentLike(req.params.commentId, req.userId, true))
);

router.delete('/:commentId/like', auth, (req, res) =>
  respond(res, () => social.setCommentLike(req.params.commentId, req.userId, false))
);

module.exports = router;

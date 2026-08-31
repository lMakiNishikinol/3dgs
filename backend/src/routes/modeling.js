const express = require('express');
const router = express.Router();
const { auth } = require('../auth');
const store = require('../store');
const { toJobView } = require('../mappers');

router.get('/:jobId', auth, (req, res) => {
  const j = store.modelingJobs.findById(req.params.jobId);
  if (!j) return res.err(404, 404, '建模任务不存在');
  if (j.userId !== req.userId) return res.err(403, 403, '无权查看');
  return res.ok(toJobView(j));
});

module.exports = router;

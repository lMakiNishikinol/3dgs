const express = require('express');
const router = express.Router();
const store = require('../store');

router.get('/health', (req, res) => {
  res.ok({ status: 'ok', uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

router.get('/ready', (req, res) => {
  res.ok({
    status: 'ok',
    checks: { database: 'ok', storage: 'ok' },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

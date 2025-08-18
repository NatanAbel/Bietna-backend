const router = require("express").Router();

router.get("/", (req, res, next) => {
  res.json("All good in here");
});

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;

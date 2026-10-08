const express = require('express');
const router = express.Router();

const userRoutes = require('./user.routes');

router.use('/user', userRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API v2 is healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/google-login', (req, res) => authController.googleLogin(req, res));

// Test mode routes - only work in development
router.post('/test-login', (req, res) => authController.testLogin(req, res));
router.get('/test-users', (req, res) => authController.getTestUsers(req, res));

module.exports = router;

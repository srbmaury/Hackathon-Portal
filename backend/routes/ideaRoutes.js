const express = require('express');
const router = express.Router();
const ideaController = require('../controllers/ideaController');
const { protect } = require('../middleware/auth'); // JWT auth middleware

router.get('/public-ideas', protect, (req, res) => ideaController.getPublicIdeas(req, res));
router.get('/my', protect, (req, res) => ideaController.getMyIdeas(req, res));
router.post('/submit', protect, (req, res) => ideaController.submitIdea(req, res));
router.put('/:id', protect, (req, res) => ideaController.editIdea(req, res));
router.delete('/:id', protect, (req, res) => ideaController.deleteIdea(req, res));

// AI-powered routes
router.post('/:id/evaluate', protect, (req, res) => ideaController.evaluate(req, res));
router.get('/:id/similar', protect, (req, res) => ideaController.findSimilar(req, res));
router.get('/:id/improvements', protect, (req, res) => ideaController.getImprovements(req, res));

module.exports = router;

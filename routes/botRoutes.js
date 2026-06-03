const express = require('express');
const protect = require('../middleware/authMiddleware');
const { runBankingAssistant } = require('../services/aiAssistantService');

const router = express.Router();

/**
 * @swagger
 * /api/bot/chat:
 *   post:
 *     summary: Chat with the AI banking assistant (JWT required)
 *     tags: [Bot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: Assistant reply
 *       401:
 *         description: Not authorized
 */
router.post('/chat', protect, async (req, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.userId;
    const io = req.app.get('io');

    const { reply, refreshDashboard } = await runBankingAssistant({
      userId,
      message,
      history,
      io,
    });

    res.status(200).json({
      reply,
      refreshDashboard,
    });
  } catch (err) {
    console.error('Bot chat error:', err);
    const status = err.status || (err.message?.includes('GOOGLE_API_KEY') ? 503 : 500);
    res.status(status).json({
      error: err.message || 'Assistant unavailable. Please try again.',
    });
  }
});

module.exports = router;

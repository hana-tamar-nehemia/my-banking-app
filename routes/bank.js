const express = require('express');
const protect = require('../middleware/authMiddleware');
const {
  formatTransaction,
  getUserBalance,
  getRecentTransactions,
  transferMoney,
} = require('../services/bankingOperations');

const router = express.Router();

/**
 * @swagger
 * /api/bank/dashboard/{userId}:
 * get:
 * summary: Get user dashboard with account balance (Protected via JWT)
 * tags: [Bank]
 * parameters:
 * - in: path
 * name: userId
 * required: true
 * schema:
 * type: string
 * description: The user's unique ID
 * responses:
 * 200:
 * description: Dashboard data retrieved successfully
 * 401:
 * description: Not authorized, token missing or failed
 * 403:
 * description: Forbidden, accessing another user's data
 * 404:
 * description: User not found
 */
router.get('/dashboard/:userId', protect, async (req, res) => {
  try {
    if (req.params.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to this account' });
    }

    const profile = await getUserBalance(req.params.userId);
    const transactions = await getRecentTransactions(req.params.userId, 50);

    res.status(200).json({
      username: profile.username,
      email: profile.email,
      balance: profile.balance,
      transactions,
    });
  } catch (err) {
    if (err.message === 'User not found' || err.name === 'CastError') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /api/bank/transaction:
 * post:
 * summary: Transfer funds from the authenticated user (sender derived from JWT)
 * tags: [Bank]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - receiverEmail
 * - amount
 * responses:
 * 200:
 * description: Transaction completed successfully
 * 401:
 * description: Not authorized
 * 400:
 * description: Insufficient balance
 * 404:
 * description: Sender or receiver not found
 */
router.post('/transaction', protect, async (req, res) => {
  try {
    const { receiverEmail, amount } = req.body;
    const io = req.app.get('io');

    const result = await transferMoney(req.user.id, receiverEmail, amount, io);

    res.status(200).json({
      message: result.message,
      transaction: result.transaction,
    });
  } catch (err) {
    const msg = err.message || 'Server error';
    if (msg === 'Sender not found' || err.name === 'CastError') {
      return res.status(404).json({ error: 'Sender not found' });
    }
    if (msg === 'Receiver not found') {
      return res.status(404).json({ error: 'Receiver not found' });
    }
    if (msg === 'Insufficient balance' || msg.includes('Amount must')) {
      return res.status(400).json({ error: msg });
    }
    if (msg.includes('own account')) {
      return res.status(400).json({ error: msg });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

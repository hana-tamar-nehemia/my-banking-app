const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

function formatTransaction(transaction) {
  return {
    id: transaction._id.toString(),
    senderId: transaction.sender.toString(),
    receiverId: transaction.receiver.toString(),
    amount: transaction.amount,
    timestamp: transaction.createdAt.toISOString(),
  };
}

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

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      username: user.username,
      email: user.email,
      balance: user.balance,
    });
  } catch (err) {
    if (err.name === 'CastError') {
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
    const fromId = req.user.id;

    const sender = await User.findById(fromId);
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const receiver = await User.findOne({
      email: receiverEmail?.toLowerCase(),
    });
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    if (amount <= 0 || sender.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    sender.balance -= amount;
    receiver.balance += amount;

    await sender.save();
    await receiver.save();

    const transaction = new Transaction({
      sender: sender._id,
      receiver: receiver._id,
      amount,
    });
    await transaction.save();

    res.status(200).json({
      message: 'Transaction successful',
      transaction: formatTransaction(transaction),
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Sender not found' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
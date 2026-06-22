const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

function idOf(ref) {
  if (!ref) return '';
  if (ref._id) return ref._id.toString();
  return ref.toString();
}

function formatTransaction(transaction) {
  return {
    id: transaction._id.toString(),
    senderId: idOf(transaction.sender),
    receiverId: idOf(transaction.receiver),
    amount: transaction.amount,
    reason: transaction.reason ?? null,
    timestamp: transaction.createdAt.toISOString(),
  };
}

/** Human-readable fields for dashboard / AI (requires populated sender & receiver). */
function formatTransactionWithParties(transaction, viewerUserId) {
  const base = formatTransaction(transaction);
  const viewerId = viewerUserId.toString();
  const isSender = base.senderId === viewerId;
  const counterparty = isSender ? transaction.receiver : transaction.sender;

  return {
    ...base,
    type: isSender ? 'sent' : 'received',
    counterpartyEmail: counterparty?.email ?? null,
    counterpartyUsername: counterparty?.username ?? null,
    senderEmail: transaction.sender?.email ?? null,
    receiverEmail: transaction.receiver?.email ?? null,
    summary: isSender
      ? `Sent $${base.amount.toFixed(2)} to ${counterparty?.email ?? 'unknown'}`
      : `Received $${base.amount.toFixed(2)} from ${counterparty?.email ?? 'unknown'}`,
  };
}

async function getUserBalance(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return {
    username: user.username,
    email: user.email,
    balance: user.balance,
  };
}

const MAX_LOAN_AMOUNT = 10000;

/**
 * Check whether the user can cover a transfer amount from their current balance.
 */
async function checkTransferFunds(userId, amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const profile = await getUserBalance(userId);
  const shortfall = Math.max(0, numericAmount - profile.balance);

  return {
    ...profile,
    amount: numericAmount,
    shortfall,
    sufficient: shortfall === 0,
  };
}

/**
 * Credit an instant loan to the authenticated user's balance (used by the AI assistant).
 */
async function issueLoan(userId, amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Loan amount must be a positive number');
  }
  if (numericAmount > MAX_LOAN_AMOUNT) {
    throw new Error(`Loan amount cannot exceed $${MAX_LOAN_AMOUNT.toFixed(2)}`);
  }

  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { balance: numericAmount } },
    { new: true }
  );
  if (!user) {
    throw new Error('User not found');
  }

  return {
    loanAmount: numericAmount,
    balance: user.balance,
    email: user.email,
    username: user.username,
  };
}

async function getRecentTransactions(userId, limit = 10, { withParties = false } = {}) {
  const transactions = await Transaction.find({
    $or: [{ sender: userId }, { receiver: userId }],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'email username')
    .populate('receiver', 'email username');

  if (withParties) {
    return transactions.map((tx) => formatTransactionWithParties(tx, userId));
  }
  return transactions.map(formatTransaction);
}

/**
 * Shared transfer logic used by REST API and AI assistant tools.
 * All balance, ledger, and notification writes run inside a MongoDB transaction.
 */
async function transferMoney(fromUserId, receiverEmail, amount, io = null, reason = null) {
  const normalizedEmail = receiverEmail?.trim().toLowerCase();
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const trimmedReason =
    typeof reason === 'string' && reason.trim() ? reason.trim() : null;

  const session = await mongoose.startSession();
  let transferResult;

  try {
    await session.withTransaction(async () => {
      const sender = await User.findById(fromUserId).session(session);
      if (!sender) {
        throw new Error('Sender not found');
      }

      const receiver = await User.findOne({ email: normalizedEmail }).session(session);
      if (!receiver) {
        throw new Error('Receiver not found');
      }

      if (sender._id.toString() === receiver._id.toString()) {
        throw new Error('Cannot transfer to your own account');
      }

      const debitedSender = await User.findOneAndUpdate(
        { _id: sender._id, balance: { $gte: numericAmount } },
        { $inc: { balance: -numericAmount } },
        { new: true, session }
      );
      if (!debitedSender) {
        throw new Error('Insufficient balance');
      }

      const creditedReceiver = await User.findOneAndUpdate(
        { _id: receiver._id },
        { $inc: { balance: numericAmount } },
        { new: true, session }
      );
      if (!creditedReceiver) {
        throw new Error('Receiver not found');
      }

      const [transaction] = await Transaction.create(
        [
          {
            sender: debitedSender._id,
            receiver: creditedReceiver._id,
            amount: numericAmount,
            ...(trimmedReason ? { reason: trimmedReason } : {}),
          },
        ],
        { session }
      );

      const [notification] = await Notification.create(
        [
          {
            user: creditedReceiver._id,
            type: 'transfer:received',
            message: `You received $${numericAmount.toFixed(2)} from ${debitedSender.email}`,
            senderEmail: debitedSender.email,
            amount: numericAmount,
          },
        ],
        { session }
      );

      const populated = await Transaction.findById(transaction._id)
        .session(session)
        .populate('sender', 'email username')
        .populate('receiver', 'email username');

      transferResult = {
        message: 'Transaction successful',
        transaction: formatTransactionWithParties(populated, fromUserId),
        newBalance: debitedSender.balance,
        notification,
        receiverId: creditedReceiver._id,
      };
    });
  } finally {
    await session.endSession();
  }

  if (io && transferResult?.notification) {
    const { notification, receiverId } = transferResult;
    io.to(receiverId.toString()).emit('transfer:received', {
      id: notification._id.toString(),
      type: notification.type,
      message: notification.message,
      senderEmail: notification.senderEmail,
      amount: notification.amount,
      read: notification.read,
      timestamp: notification.createdAt.toISOString(),
    });
  }

  const { notification: _notification, receiverId: _receiverId, ...result } = transferResult;
  return result;
}

module.exports = {
  formatTransaction,
  formatTransactionWithParties,
  getUserBalance,
  getRecentTransactions,
  checkTransferFunds,
  issueLoan,
  transferMoney,
  MAX_LOAN_AMOUNT,
};

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
 */
async function transferMoney(fromUserId, receiverEmail, amount, io = null) {
  const sender = await User.findById(fromUserId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  const normalizedEmail = receiverEmail?.trim().toLowerCase();
  const receiver = await User.findOne({ email: normalizedEmail });
  if (!receiver) {
    throw new Error('Receiver not found');
  }

  if (sender.email === normalizedEmail) {
    throw new Error('Cannot transfer to your own account');
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  if (sender.balance < numericAmount) {
    throw new Error('Insufficient balance');
  }

  sender.balance -= numericAmount;
  receiver.balance += numericAmount;

  await sender.save();
  await receiver.save();

  const transaction = await Transaction.create({
    sender: sender._id,
    receiver: receiver._id,
    amount: numericAmount,
  });

  const notification = await Notification.create({
    user: receiver._id,
    type: 'transfer:received',
    message: `You received $${numericAmount.toFixed(2)} from ${sender.email}`,
    senderEmail: sender.email,
    amount: numericAmount,
  });

  if (io) {
    io.to(receiver._id.toString()).emit('transfer:received', {
      id: notification._id.toString(),
      type: notification.type,
      message: notification.message,
      senderEmail: notification.senderEmail,
      amount: notification.amount,
      read: notification.read,
      timestamp: notification.createdAt.toISOString(),
    });
  }

  return {
    message: 'Transaction successful',
    transaction: formatTransaction(transaction),
    newBalance: sender.balance,
  };
}

module.exports = {
  formatTransaction,
  formatTransactionWithParties,
  getUserBalance,
  getRecentTransactions,
  transferMoney,
};

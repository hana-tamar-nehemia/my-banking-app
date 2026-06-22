jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    startSession: jest.fn().mockResolvedValue({
      withTransaction: jest.fn((fn) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    }),
  };
});

jest.mock('../models/User');
jest.mock('../models/Transaction');
jest.mock('../models/Notification');

const jwt = require('jsonwebtoken');
const request = require('supertest');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const app = require('../app');

const TEST_JWT_SECRET = 'test-jwt-secret';
const TRANSACTION_URL = '/api/bank/transaction';

const senderId = '507f1f77bcf86cd799439011';
const receiverId = '507f1f77bcf86cd799439012';
const transactionId = '507f1f77bcf86cd799439013';

function authHeader(userId = senderId) {
  const token = jwt.sign({ id: userId }, TEST_JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

function chainableQuery(result) {
  const query = {
    session: jest.fn(function session() {
      return this;
    }),
    populate: jest.fn(function populate() {
      return this;
    }),
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return query;
}

function buildSender(balance) {
  return {
    _id: senderId,
    email: 'sender@example.com',
    username: 'sender_user',
    balance,
  };
}

function buildReceiver() {
  return {
    _id: receiverId,
    email: 'receiver@example.com',
    username: 'receiver_user',
    balance: 500,
  };
}

function mockPopulatedTransaction({ amount, reason }) {
  const createdAt = new Date('2024-06-01T12:00:00.000Z');

  Transaction.create.mockResolvedValue([{ _id: transactionId }]);
  Transaction.findById.mockReturnValue(
    chainableQuery({
      _id: transactionId,
      sender: {
        _id: senderId,
        email: 'sender@example.com',
        username: 'sender_user',
      },
      receiver: {
        _id: receiverId,
        email: 'receiver@example.com',
        username: 'receiver_user',
      },
      amount,
      reason: reason ?? null,
      createdAt,
    })
  );

  Notification.create.mockResolvedValue([
    {
      _id: '507f1f77bcf86cd799439014',
      type: 'transfer:received',
      message: `You received $${amount.toFixed(2)} from sender@example.com`,
      senderEmail: 'sender@example.com',
      amount,
      read: false,
      createdAt,
    },
  ]);
}

describe('POST /api/bank/transaction', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with a success message and transaction including reason', async () => {
    const sender = buildSender(1000);
    const receiver = buildReceiver();

    User.findById.mockReturnValue(chainableQuery(sender));
    User.findOne.mockReturnValue(chainableQuery(receiver));
    User.findOneAndUpdate
      .mockResolvedValueOnce({ ...sender, balance: 900 })
      .mockResolvedValueOnce({ ...receiver, balance: 600 });
    mockPopulatedTransaction({ amount: 100, reason: 'Monthly rent' });

    const response = await request(app)
      .post(TRANSACTION_URL)
      .set(authHeader())
      .send({
        receiverEmail: 'receiver@example.com',
        amount: 100,
        reason: 'Monthly rent',
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Transaction successful');
    expect(response.body.transaction).toMatchObject({
      id: transactionId,
      senderId,
      receiverId,
      amount: 100,
      reason: 'Monthly rent',
      type: 'sent',
      counterpartyEmail: 'receiver@example.com',
      counterpartyUsername: 'receiver_user',
    });
    expect(User.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(User.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { _id: senderId, balance: { $gte: 100 } },
      { $inc: { balance: -100 } },
      expect.objectContaining({ new: true, session: expect.any(Object) })
    );
    expect(User.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: receiverId },
      { $inc: { balance: 100 } },
      expect.objectContaining({ new: true, session: expect.any(Object) })
    );
    expect(Transaction.create).toHaveBeenCalledWith(
      [
        {
          sender: senderId,
          receiver: receiverId,
          amount: 100,
          reason: 'Monthly rent',
        },
      ],
      expect.objectContaining({ session: expect.any(Object) })
    );
  });

  it('returns 400 when the sender has insufficient balance', async () => {
    const sender = buildSender(50);
    const receiver = buildReceiver();

    User.findById.mockReturnValue(chainableQuery(sender));
    User.findOne.mockReturnValue(chainableQuery(receiver));
    User.findOneAndUpdate.mockResolvedValueOnce(null);

    const response = await request(app)
      .post(TRANSACTION_URL)
      .set(authHeader())
      .send({
        receiverEmail: 'receiver@example.com',
        amount: 100,
        reason: 'Groceries',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Insufficient balance' });
    expect(User.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(Transaction.create).not.toHaveBeenCalled();
  });
});

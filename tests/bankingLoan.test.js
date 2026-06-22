jest.mock('../models/User');

const User = require('../models/User');
const {
  checkTransferFunds,
  issueLoan,
  MAX_LOAN_AMOUNT,
} = jest.requireActual('../services/bankingOperations');
const { parseLoanDecision, rejectLoanFlow, acceptLoanFlow } = require('../services/transferLoanGraph');
const {
  getLoanSession,
  setLoanSession,
  clearLoanSession,
  clearAllLoanSessions,
} = require('../services/loanSessionStore');
const bankingOperations = require('../services/bankingOperations');

const userId = '507f1f77bcf86cd799439011';

describe('checkTransferFunds', () => {
  beforeEach(() => {
    User.findById.mockResolvedValue({
      username: 'alice',
      email: 'alice@example.com',
      balance: 150,
    });
  });

  it('reports sufficient funds when balance covers the amount', async () => {
    const result = await checkTransferFunds(userId, 100);

    expect(result).toEqual({
      username: 'alice',
      email: 'alice@example.com',
      balance: 150,
      amount: 100,
      shortfall: 0,
      sufficient: true,
    });
  });

  it('reports shortfall when balance is too low', async () => {
    const result = await checkTransferFunds(userId, 200);

    expect(result.shortfall).toBe(50);
    expect(result.sufficient).toBe(false);
  });
});

describe('issueLoan', () => {
  beforeEach(() => {
    User.findOneAndUpdate.mockResolvedValue({
      username: 'alice',
      email: 'alice@example.com',
      balance: 200,
    });
  });

  it('credits the requested loan amount', async () => {
    const result = await issueLoan(userId, 50);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: userId },
      { $inc: { balance: 50 } },
      { new: true }
    );
    expect(result).toEqual({
      loanAmount: 50,
      balance: 200,
      email: 'alice@example.com',
      username: 'alice',
    });
  });

  it('rejects non-positive loan amounts', async () => {
    await expect(issueLoan(userId, 0)).rejects.toThrow('Loan amount must be a positive number');
  });

  it('rejects loans above the configured maximum', async () => {
    await expect(issueLoan(userId, MAX_LOAN_AMOUNT + 1)).rejects.toThrow(
      `Loan amount cannot exceed $${MAX_LOAN_AMOUNT.toFixed(2)}`
    );
  });
});

describe('parseLoanDecision', () => {
  it('detects accept and reject replies', () => {
    expect(parseLoanDecision('Yes')).toBe('accept');
    expect(parseLoanDecision('no thanks')).toBe('reject');
    expect(parseLoanDecision('כן')).toBe('accept');
    expect(parseLoanDecision('לא')).toBe('reject');
    expect(parseLoanDecision('maybe later')).toBeNull();
  });
});

describe('loan session store', () => {
  afterEach(() => {
    clearAllLoanSessions();
  });

  it('stores and clears pending loan sessions per user', () => {
    setLoanSession(userId, {
      receiverEmail: 'bob@example.com',
      amount: 200,
      shortfall: 50,
      balance: 150,
    });

    const session = getLoanSession(userId);
    expect(session.status).toBe('awaiting_loan_decision');
    expect(session.shortfall).toBe(50);

    clearLoanSession(userId);
    expect(getLoanSession(userId)).toBeNull();
  });
});

describe('loan decision flows', () => {
  const session = {
    receiverEmail: 'bob@example.com',
    amount: 200,
    shortfall: 50,
    balance: 150,
    status: 'awaiting_loan_decision',
  };

  let issueLoanSpy;
  let transferMoneySpy;

  beforeEach(() => {
    clearAllLoanSessions();
    setLoanSession(userId, session);
    issueLoanSpy = jest.spyOn(bankingOperations, 'issueLoan').mockResolvedValue({ balance: 200 });
    transferMoneySpy = jest.spyOn(bankingOperations, 'transferMoney').mockResolvedValue({
      message: 'Transaction successful',
      newBalance: 0,
    });
  });

  afterEach(() => {
    issueLoanSpy.mockRestore();
    transferMoneySpy.mockRestore();
    clearAllLoanSessions();
  });

  it('rejects the loan without touching balances when the user declines', async () => {
    const result = await rejectLoanFlow(userId);

    expect(result.refreshDashboard).toBe(false);
    expect(result.reply).toMatch(/unchanged/i);
    expect(issueLoanSpy).not.toHaveBeenCalled();
    expect(transferMoneySpy).not.toHaveBeenCalled();
    expect(getLoanSession(userId)).toBeNull();
  });

  it('grants a loan and completes the transfer when the user accepts', async () => {
    const result = await acceptLoanFlow({ userId, session, io: null });

    expect(issueLoanSpy).toHaveBeenCalledWith(userId, 50);
    expect(transferMoneySpy).toHaveBeenCalledWith(
      userId,
      'bob@example.com',
      200,
      null
    );
    expect(result.refreshDashboard).toBe(true);
    expect(result.reply).toMatch(/loan of \$50\.00/i);
    expect(getLoanSession(userId)).toBeNull();
  });
});

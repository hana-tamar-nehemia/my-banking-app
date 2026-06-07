jest.mock('../models/User');

const jwt = require('jsonwebtoken');
const request = require('supertest');
const User = require('../models/User');
const app = require('../app');

const TEST_JWT_SECRET = 'test-jwt-secret';
const LOGIN_URL = '/api/auth/login';

const verifiedUser = {
  _id: '507f1f77bcf86cd799439011',
  username: 'jane_doe',
  email: 'jane@example.com',
  balance: 1000,
  isVerified: true,
  comparePassword: jest.fn(),
};

describe('POST /api/auth/login', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    verifiedUser.comparePassword.mockReset();
  });

  it('returns 200 with user data and a valid JWT when credentials are correct', async () => {
    verifiedUser.comparePassword.mockResolvedValue(true);
    User.findOne.mockResolvedValue(verifiedUser);

    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email: 'jane@example.com', password: 'secret123' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Login successful');
    expect(response.body.user).toEqual({
      id: verifiedUser._id,
      username: verifiedUser.username,
      email: verifiedUser.email,
      balance: verifiedUser.balance,
    });
    expect(response.body.token).toEqual(expect.any(String));

    const decoded = jwt.verify(response.body.token, TEST_JWT_SECRET);
    expect(decoded.id).toBe(verifiedUser._id);
    expect(User.findOne).toHaveBeenCalledWith({ email: 'jane@example.com' });
    expect(verifiedUser.comparePassword).toHaveBeenCalledWith('secret123');
  });

  it('returns 401 when the user is not found', async () => {
    User.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email: 'missing@example.com', password: 'secret123' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid credentials' });
  });

  it('returns 401 when the password is incorrect', async () => {
    verifiedUser.comparePassword.mockResolvedValue(false);
    User.findOne.mockResolvedValue(verifiedUser);

    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email: 'jane@example.com', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid credentials' });
    expect(verifiedUser.comparePassword).toHaveBeenCalledWith('wrong-password');
  });
});

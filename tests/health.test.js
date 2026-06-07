const request = require('supertest');
const app = require('../app');

describe('GET /', () => {
  it('returns 200 and a running status message', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Bank API is running' });
  });
});

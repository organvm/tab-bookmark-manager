jest.mock('axios');
jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const axios = require('axios');
const mlServiceClient = require('../utils/mlServiceClient');

describe('mlServiceClient', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
  });

  it('marks the ML service healthy after a successful health check', async () => {
    axios.get.mockResolvedValue({ status: 200 });

    await expect(mlServiceClient.checkMLServiceHealth()).resolves.toBe(true);

    expect(axios.get).toHaveBeenCalledWith('http://localhost:5000/health', {
      timeout: 5000,
    });
    expect(mlServiceClient.getMLServiceStatus()).toMatchObject({
      healthy: true,
      lastCheck: expect.any(Date),
    });
  });

  it('marks the ML service unhealthy when the health check fails', async () => {
    axios.get.mockRejectedValue(new Error('connection refused'));

    await expect(mlServiceClient.checkMLServiceHealth()).resolves.toBe(false);

    expect(mlServiceClient.getMLServiceStatus()).toMatchObject({
      healthy: false,
      lastCheck: expect.any(Date),
    });
  });

  it('posts data to the ML service and returns the response body', async () => {
    axios.post.mockResolvedValue({
      data: {
        summary: 'Short summary',
      },
    });

    const result = await mlServiceClient.callMLService('/api/analyze', {
      text: 'Article body',
      url: 'https://example.com',
    }, 0);

    expect(result).toEqual({ summary: 'Short summary' });
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:5000/api/analyze',
      {
        text: 'Article body',
        url: 'https://example.com',
      },
      expect.objectContaining({
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
    expect(mlServiceClient.getMLServiceStatus().healthy).toBe(true);
  });

  it('returns null and marks the service unhealthy after a connection failure', async () => {
    const error = new Error('connect ECONNREFUSED');
    error.code = 'ECONNREFUSED';
    axios.post.mockRejectedValue(error);

    await expect(mlServiceClient.callMLService('/api/embed', { text: 'query' }, 0))
      .resolves
      .toBeNull();

    expect(mlServiceClient.getMLServiceStatus().healthy).toBe(false);
  });

  it('skips analysis requests while the ML service is unhealthy', async () => {
    axios.get.mockRejectedValue(new Error('still down'));
    await mlServiceClient.checkMLServiceHealth();
    axios.post.mockClear();

    await expect(mlServiceClient.analyzeContent('content', 'https://example.com'))
      .resolves
      .toBeNull();

    expect(axios.post).not.toHaveBeenCalled();
  });
});

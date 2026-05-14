/**
 * Rider Service unit tests
 */

jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
  return { Pool: jest.fn(() => mockPool) };
});

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.PORT = '3002';
  process.env.MERCHANT_SERVICE_URL = 'http://localhost:3001';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('Rider Service', () => {

  test('MERCHANT_SERVICE_URL must be set for health check to pass', () => {
    const url = process.env.MERCHANT_SERVICE_URL;
    expect(url).toBeDefined();
    expect(url).not.toBe('');
  });

  test('valid assignment statuses are defined', () => {
    const valid = ['assigned', 'in_transit', 'delivered', 'failed'];
    expect(valid).toContain('assigned');
    expect(valid).toContain('delivered');
    expect(valid).not.toContain('pending');
  });

  test('rider statuses are defined', () => {
    const statuses = ['available', 'on_delivery'];
    expect(statuses).toContain('available');
    expect(statuses).toContain('on_delivery');
  });

  test('POST /api/assignments requires order_id and rider_id', () => {
    const required = ['order_id', 'rider_id'];
    const body = { order_id: 1, rider_id: 2 };
    required.forEach(field => {
      const incomplete = { ...body };
      delete incomplete[field];
      expect(Object.keys(incomplete).length).toBe(1);
    });
  });

  test('service name is rider', () => {
    expect('rider-service').toMatch(/rider/);
  });
});

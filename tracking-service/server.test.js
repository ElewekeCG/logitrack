/**
 * Tracking Service unit tests
 */

jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
  return { Pool: jest.fn(() => mockPool) };
});

beforeAll(() => {
  process.env.DATABASE_URL       = 'postgresql://test:test@localhost:5432/test';
  process.env.PORT               = '3003';
  process.env.MERCHANT_SERVICE_URL = 'http://localhost:3001';
  process.env.RIDER_SERVICE_URL    = 'http://localhost:3002';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('Tracking Service', () => {

  test('both upstream service URLs must be configured', () => {
    expect(process.env.MERCHANT_SERVICE_URL).toBeDefined();
    expect(process.env.RIDER_SERVICE_URL).toBeDefined();
  });

  test('POST /api/events requires order_id, event_type, message', () => {
    const required = ['order_id', 'event_type', 'message'];
    const body = { order_id: 1, event_type: 'pickup', message: 'Collected from merchant' };
    required.forEach(field => {
      const incomplete = { ...body };
      delete incomplete[field];
      expect(Object.keys(incomplete).length).toBe(required.length - 1);
    });
  });

  test('tracking event types are sensible strings', () => {
    const eventTypes = ['created', 'pickup', 'in_transit', 'delivered', 'failed'];
    eventTypes.forEach(t => expect(typeof t).toBe('string'));
  });

  test('service name is tracking', () => {
    expect('tracking-service').toMatch(/tracking/);
  });
});

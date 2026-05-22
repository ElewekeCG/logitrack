/**
 * LogiTrack Merchant Service
 * Handles delivery order creation and merchant management.
 * Runs on port 3001.
 */

require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ── Database connection ───────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id          SERIAL PRIMARY KEY,
      merchant_id VARCHAR(50)  NOT NULL,
      customer    VARCHAR(100) NOT NULL,
      address     TEXT         NOT NULL,
      items       TEXT         NOT NULL,
      status      VARCHAR(20)  NOT NULL DEFAULT 'pending',
      created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS merchants (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      email      VARCHAR(100) UNIQUE NOT NULL,
      phone      VARCHAR(20)  NOT NULL,
      created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Seed a test merchant if none exist
  const { rowCount } = await pool.query('SELECT id FROM merchants LIMIT 1');
  if (rowCount === 0) {
    await pool.query(`
      INSERT INTO merchants (name, email, phone) VALUES
      ('Wuse Market Fabrics', 'wuse@logitrack.ng', '08012345678'),
      ('Garki Electronics',   'garki@logitrack.ng', '08087654321')
    `);
  }
  console.log('Merchant Service: database ready');
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'merchant', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', service: 'merchant', error: err.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────

// GET all merchants
app.get('/api/merchants', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM merchants ORDER BY id');
  res.json(rows);
});

// GET all orders
app.get('/api/orders', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json(rows);
});

// GET single order
app.get('/api/orders/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(rows[0]);
});

// POST create order
app.post('/api/orders', async (req, res) => {
  const { merchant_id, customer, address, items } = req.body;
  if (!merchant_id || !customer || !address || !items) {
    return res.status(400).json({ error: 'merchant_id, customer, address, and items are required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO orders (merchant_id, customer, address, items) VALUES ($1, $2, $3, $4) RETURNING *',
    [merchant_id, customer, address, items]
  );
  res.status(201).json(rows[0]);
});

// PATCH update order status
app.patch('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'assigned', 'in_transit', 'delivered', 'failed'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }
  const { rows } = await pool.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.json(rows[0]);
});

// ── Start ─────────────────────────────────────────────────────────────────────

initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Merchant Service running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Merchant Service: failed to start', err.message);
    process.exit(1);
  });

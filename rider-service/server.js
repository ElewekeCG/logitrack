/**
 * LogiTrack Rider Service
 * Manages riders and dispatches delivery assignments.
 * Runs on port 3002.
 *
 * DEPENDS ON: Merchant Service (MERCHANT_SERVICE_URL env var)
 * This is the service whose missing env var caused the Black Friday incident.
 * The health check verifies both database AND Merchant Service connectivity.
 */

require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');
const http     = require('http');

const app  = express();
const PORT = process.env.PORT || 3002;

// ── This is the critical env var ─────────────────────────────────────────────
// If MERCHANT_SERVICE_URL is missing, the health check will fail.
// This is what caused the Black Friday incident.
const MERCHANT_SERVICE_URL = process.env.MERCHANT_SERVICE_URL;

app.use(express.json());


// ── Database connection ───────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS riders (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      phone      VARCHAR(20)  UNIQUE NOT NULL,
      status     VARCHAR(20)  NOT NULL DEFAULT 'available',
      location   VARCHAR(100),
      created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id          SERIAL PRIMARY KEY,
      order_id    INTEGER      NOT NULL,
      rider_id    INTEGER      NOT NULL,
      status      VARCHAR(20)  NOT NULL DEFAULT 'assigned',
      assigned_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      delivered_at TIMESTAMP
    )
  `);
  const { rowCount } = await pool.query('SELECT id FROM riders LIMIT 1');
  if (rowCount === 0) {
    await pool.query(`
      INSERT INTO riders (name, phone, status, location) VALUES
      ('Chukwudi Obi',   '07011111111', 'available', 'Garki'),
      ('Amina Hassan',   '07022222222', 'available', 'Wuse'),
      ('Tunde Adeyemi',  '07033333333', 'on_delivery', 'Maitama')
    `);
  }
  console.log('Rider Service: database ready');
}

// ── Check merchant service connectivity ───────────────────────────────────────
function checkMerchantService() {
  return new Promise((resolve) => {
    if (!MERCHANT_SERVICE_URL) {
      // This is the Black Friday bug — missing env var
      resolve({ ok: false, error: 'MERCHANT_SERVICE_URL is not configured' });
      return;
    }
    const url = `${MERCHANT_SERVICE_URL}/health`;
    http.get(url, (res) => {
      resolve({ ok: res.statusCode === 200 });
    }).on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const checks = { database: false, merchant_service: false };
  const errors = [];

  try {
    await pool.query('SELECT 1');
    checks.database = true;
  } catch (err) {
    errors.push(`database: ${err.message}`);
  }

  const merchantCheck = await checkMerchantService();
  checks.merchant_service = merchantCheck.ok;
  if (!merchantCheck.ok) {
    errors.push(`merchant_service: ${merchantCheck.error || 'unreachable'}`);
  }

  const allOk = Object.values(checks).every(Boolean);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    service: 'rider',
    checks,
    ...(errors.length > 0 && { errors })
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────

// GET all riders
app.get('/api/riders', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM riders ORDER BY id');
  res.json(rows);
});

// GET available riders
app.get('/api/riders/available', async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM riders WHERE status = 'available' ORDER BY id"
  );
  res.json(rows);
});

// POST dispatch assignment — assigns a rider to an order
app.post('/api/assignments', async (req, res) => {
  const { order_id, rider_id } = req.body;
  if (!order_id || !rider_id) {
    return res.status(400).json({ error: 'order_id and rider_id are required' });
  }

  // Verify the order exists in the Merchant Service
  if (!MERCHANT_SERVICE_URL) {
    return res.status(503).json({ error: 'Merchant Service not configured — cannot verify order' });
  }

  try {
    await new Promise((resolve, reject) => {
      http.get(`${MERCHANT_SERVICE_URL}/api/orders/${order_id}`, (res) => {
        if (res.statusCode === 404) reject(new Error(`Order ${order_id} not found`));
        else resolve();
      }).on('error', reject);
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { rows: assignment } = await pool.query(
    'INSERT INTO assignments (order_id, rider_id) VALUES ($1, $2) RETURNING *',
    [order_id, rider_id]
  );
  await pool.query("UPDATE riders SET status = 'on_delivery' WHERE id = $1", [rider_id]);

  res.status(201).json(assignment[0]);
});

// GET all assignments
app.get('/api/assignments', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM assignments ORDER BY assigned_at DESC');
  res.json(rows);
});

// PATCH update assignment status
app.patch('/api/assignments/:id/status', async (req, res) => {
  const { status } = req.body;
  const valid = ['assigned', 'in_transit', 'delivered', 'failed'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
  }
  const { rows } = await pool.query(
    'UPDATE assignments SET status = $1, delivered_at = CASE WHEN $1 = $2 THEN NOW() ELSE delivered_at END WHERE id = $3 RETURNING *',
    [status, 'delivered', req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });

  // If delivered, mark rider as available again
  if (status === 'delivered' || status === 'failed') {
    await pool.query("UPDATE riders SET status = 'available' WHERE id = $1", [rows[0].rider_id]);
  }
  res.json(rows[0]);
});

// ── Start ─────────────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Rider Service running on port ${PORT}`);
      if (!MERCHANT_SERVICE_URL) {
        console.warn('WARNING: MERCHANT_SERVICE_URL is not set — health check will fail');
      }
    });
  })
  .catch(err => {
    console.error('Rider Service: failed to start', err.message);
    process.exit(1);
  });

/**
 * LogiTrack Tracking Service
 * Aggregates events from Merchant and Rider services to build real-time
 * delivery tracking status. Exposes the API that customers use.
 * Runs on port 3003.
 *
 * DEPENDS ON: Merchant Service AND Rider Service
 * Must start last.
 */

require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');
const http     = require('http');

const app  = express();
const PORT = process.env.PORT || 3003;

const MERCHANT_SERVICE_URL = process.env.MERCHANT_SERVICE_URL;
const RIDER_SERVICE_URL    = process.env.RIDER_SERVICE_URL;

app.use(express.json());

// ── Database connection ───────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracking_events (
      id         SERIAL PRIMARY KEY,
      order_id   INTEGER     NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      message    TEXT        NOT NULL,
      location   VARCHAR(100),
      created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Tracking Service: database ready');
}

// ── Helper: check a service's health ─────────────────────────────────────────
function checkService(url, name) {
  return new Promise((resolve) => {
    if (!url) {
      resolve({ name, ok: false, error: `${name.toUpperCase()}_URL is not configured` });
      return;
    }
    http.get(`${url}/health`, (res) => {
      resolve({ name, ok: res.statusCode === 200 });
    }).on('error', (err) => {
      resolve({ name, ok: false, error: err.message });
    });
  });
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const checks = { database: false, merchant_service: false, rider_service: false };
  const errors = [];

  try {
    await pool.query('SELECT 1');
    checks.database = true;
  } catch (err) {
    errors.push(`database: ${err.message}`);
  }

  const [merchantResult, riderResult] = await Promise.all([
    checkService(MERCHANT_SERVICE_URL, 'merchant_service'),
    checkService(RIDER_SERVICE_URL,    'rider_service'),
  ]);

  checks.merchant_service = merchantResult.ok;
  checks.rider_service    = riderResult.ok;
  if (!merchantResult.ok) errors.push(`merchant_service: ${merchantResult.error || 'unreachable'}`);
  if (!riderResult.ok)    errors.push(`rider_service: ${riderResult.error || 'unreachable'}`);

  const allOk = Object.values(checks).every(Boolean);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    service: 'tracking',
    checks,
    ...(errors.length > 0 && { errors })
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────

// POST record a tracking event
app.post('/api/events', async (req, res) => {
  const { order_id, event_type, message, location } = req.body;
  if (!order_id || !event_type || !message) {
    return res.status(400).json({ error: 'order_id, event_type, and message are required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO tracking_events (order_id, event_type, message, location) VALUES ($1, $2, $3, $4) RETURNING *',
    [order_id, event_type, message, location || null]
  );
  res.status(201).json(rows[0]);
});

// GET tracking history for an order
app.get('/api/track/:order_id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM tracking_events WHERE order_id = $1 ORDER BY created_at ASC',
    [req.params.order_id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: `No tracking events found for order ${req.params.order_id}` });
  }

  // Latest event determines current status
  const latest = rows[rows.length - 1];
  res.json({
    order_id: parseInt(req.params.order_id),
    current_status: latest.event_type,
    current_location: latest.location,
    last_update: latest.created_at,
    events: rows
  });
});

// GET live dashboard — order count per status from Merchant Service
app.get('/api/dashboard', async (req, res) => {
  if (!MERCHANT_SERVICE_URL) {
    return res.status(503).json({ error: 'Merchant Service not configured' });
  }

  // Get recent tracking events from our own DB
  const { rows: recentEvents } = await pool.query(
    'SELECT * FROM tracking_events ORDER BY created_at DESC LIMIT 20'
  );

  res.json({
    service: 'tracking',
    recent_events: recentEvents,
    dependencies: {
      merchant_service: MERCHANT_SERVICE_URL || 'not configured',
      rider_service:    RIDER_SERVICE_URL    || 'not configured',
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Tracking Service running on port ${PORT}`);
      if (!MERCHANT_SERVICE_URL) console.warn('WARNING: MERCHANT_SERVICE_URL not set');
      if (!RIDER_SERVICE_URL)    console.warn('WARNING: RIDER_SERVICE_URL not set');
    });
  })
  .catch(err => {
    console.error('Tracking Service: failed to start', err.message);
    process.exit(1);
  });

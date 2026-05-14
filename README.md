# LogiTrack Nigeria — Three-Service Backend

Last-mile logistics platform with three backend services.

## Services

| Service | Port | Depends On |
|---|---|---|
| merchant-service | 3001 | PostgreSQL |
| rider-service | 3002 | PostgreSQL + merchant-service |
| tracking-service | 3003 | PostgreSQL + merchant-service + rider-service |

## Quick Start (local, no Docker)

```bash
# Terminal 1 — start postgres (requires PostgreSQL installed locally)
# Or use Docker: docker run -e POSTGRES_DB=logitrack -e POSTGRES_USER=logitrack -e POSTGRES_PASSWORD=logitrack_password -p 5432:5432 postgres:15-alpine

# Terminal 2 — merchant service
cd merchant-service && cp .env.example .env
# Edit .env: set DATABASE_URL to point to your local postgres
npm install && npm start

# Terminal 3 — rider service
cd rider-service && cp .env.example .env
# Edit .env: DATABASE_URL + MERCHANT_SERVICE_URL=http://localhost:3001
npm install && npm start

# Terminal 4 — tracking service
cd tracking-service && cp .env.example .env
# Edit .env: DATABASE_URL + MERCHANT_SERVICE_URL=http://localhost:3001 + RIDER_SERVICE_URL=http://localhost:3002
npm install && npm start
```

## Your Task

You do NOT modify the application code.

Your job is to:
1. Write a Dockerfile for each service
2. Write a docker-compose.yml that runs all three services + PostgreSQL together
3. Add health checks so services start in the correct order automatically
4. Build a GitHub Actions pipeline that tests, builds, and deploys all three in sequence

See the case study document for full instructions.

## API Endpoints

### Merchant Service (port 3001)
- `GET  /health`
- `GET  /api/merchants`
- `GET  /api/orders`
- `GET  /api/orders/:id`
- `POST /api/orders`
- `PATCH /api/orders/:id/status`

### Rider Service (port 3002)
- `GET  /health`               ← fails if MERCHANT_SERVICE_URL is not set
- `GET  /api/riders`
- `GET  /api/riders/available`
- `POST /api/assignments`
- `GET  /api/assignments`
- `PATCH /api/assignments/:id/status`

### Tracking Service (port 3003)
- `GET  /health`               ← fails if either upstream service is not set
- `POST /api/events`
- `GET  /api/track/:order_id`
- `GET  /api/dashboard`

## The Black Friday Bug

The Rider Service health check at `GET /health` returns 503 if
`MERCHANT_SERVICE_URL` is not set in the environment.

When you write the GitHub Actions pipeline, the health check gate after
the Rider Service deployment will catch this misconfiguration automatically
— before any orders are affected.

To simulate Black Friday in your pipeline: temporarily remove
`MERCHANT_SERVICE_URL` from the Rider Service environment and push.
Watch the health check gate block the deployment and roll back.

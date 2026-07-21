# LocalLoop

A runnable multi-tier delivery platform demo with a React client, Node.js API tier, PostgreSQL transactional inventory, MongoDB order data, Redis caching/metrics, Docker, health checks, structured correlation logs, and Jest tests.

## Run

```bash
docker compose up --build
```

Open `http://localhost:5173`. API health: `http://localhost:4000/health`.

Demo users are selected from the sign-in screen. To prove inventory correctness under concurrent requests:

```bash
docker compose exec api npm test
```

## Architecture

```text
React client -> Node/Express API -> PostgreSQL (atomic stock) + MongoDB (orders/logs) + Redis (cache/latency histograms)
                                  -> /health reports each dependency
```

The stock reservation query locks the product row (`SELECT ... FOR UPDATE`) inside a PostgreSQL transaction. Two requests cannot both pass validation against the same inventory snapshot.

## Project layout

- `apps/web` — React/Vite role-aware customer, vendor, and admin dashboard
- `apps/api` — Express REST API, correlation IDs, health checks, observability
- `infra/init.sql` — product/inventory schema and demo data
- `scripts/concurrent-order-test.js` — stress test used by Jest

## API

- `GET /api/products`
- `POST /api/orders` `{ customerId, items: [{ productId, quantity }] }`
- `GET /api/orders?customerId=...`
- `POST /api/products` (vendor/admin)
- `PATCH /api/products/:id/stock` (vendor/admin)
- `GET /api/metrics/latency` (admin)
- `GET /health`
# localloop

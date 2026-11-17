# Enterprise-Grade URL Shortener Backend

A high-throughput, low-latency URL Shortener microservice built with **Node.js 20+**, **Fastify v5**, **Redis 7**, **PostgreSQL**, and **Prisma ORM**.

Designed following clean layered architecture, event-driven asynchronous processing, cache-aside read patterns, strict SSRF protection, and graceful lifecycle management.

---

## Architecture Overview

```
                      ┌──────────────────────┐
                      │    Client / Browser  │
                      └──────────┬───────────┘
                                 │
                 HTTP Redirect   │   REST API Requests
                 (GET /:code)    │   (POST /api/v1/urls, etc.)
                                 ▼
                     ┌──────────────────────┐
                     │ Fastify HTTP Server  │
                     │  - Helmet & CORS     │
                     │  - Rate Limiting     │
                     │  - Zod Validation    │
                     └──────┬────────┬──────┘
                            │        │
             Cache Hit (1ms)│        │ Cache Miss / Write
                            ▼        ▼
                   ┌──────────┐    ┌────────────┐
                   │  Redis   │    │ PostgreSQL │
                   │  Cache   │    │  (Prisma)  │
                   └────┬─────┘    └────────────┘
                        │
                        │ LPUSH url.clicked (Async / Non-blocking)
                        ▼
                 ┌───────────────┐
                 │  Redis Queue  │
                 │ ('url:clicks')│
                 └──────┬────────┘
                        │
                        │ BRPOP (Batched Consumer)
                        ▼
             ┌─────────────────────┐
             │  Click Tracking     │
             │  Worker Process     │
             └──────────┬──────────┘
                        │
                        │ Batch INSERT (Every 1.5s / 50 clicks)
                        ▼
                 ┌───────────────┐
                 │  PostgreSQL   │
                 │ ('url_clicks')│
                 └───────────────┘
```

---

## Key Engineering Decisions

### 1. High-Performance Redirects with Cache-Aside
- **Sub-millisecond resolution**: Short URL lookups check Redis first (`url:cache:<shortCode>`).
- If cached, Fastify immediately responds with an HTTP `302 Found` redirect without touching PostgreSQL.
- If cache miss occurs, the URL is retrieved from PostgreSQL and written into Redis with an automatic TTL (default: 24h).

### 2. Decoupled Click Analytics via Redis Queue & Worker
- Redirect requests **do not block** waiting for analytical database writes.
- A lightweight click event payload (`ipAddress`, `userAgent`, `referer`, `timestamp`, `urlId`) is pushed asynchronously to Redis (`url:clicks`).
- A dedicated consumer worker (`src/workers/url-click.worker.js`) pulls events, buffers them, and commits them in batches to PostgreSQL via `createMany`, reducing database I/O by up to 95% under high load.
- If batch insertion encounters constraint violations (e.g. concurrent deletion), it automatically falls back to granular single-record writes without crashing or dropping valid events.

### 3. SSRF Protection & URL Sanitization
- Prevents attackers from shortening internal or private addresses (`127.0.0.1`, `localhost`, `::1`, `169.254.169.254`, private class IPs).
- Blocks non-HTTP protocols (`javascript:`, `file:`, `data:`).
- Prevents infinite redirection loops where the shortener domain targets itself.

### 4. Robust Collision & Custom Alias Handling
- Cryptographically secure 7-character Base62 generation ($62^7 \approx 3.5 \text{ trillion}$ unique combinations).
- Built-in collision retry mechanism with database unique constraint enforcement.
- Custom vanity short codes supported with strict alphanumeric validation and reserved keyword collision avoidance (e.g., `health`, `api`, `ready`).

### 5. Production Lifecycle & Observability
- **Graceful Shutdown**: Intercepts `SIGINT` and `SIGTERM` to drain active HTTP connections, flush worker buffers, and disconnect Redis and Prisma cleanly.
- **Deep Health Probes**: `/health` (process liveness) and `/health/ready` (active PostgreSQL and Redis readiness check).
- **Fastify Structured Logging**: Integrated with Pino for machine-readable JSON logging in production and colorized human-readable logs in development.
- **Native BigInt Serialization**: Seamlessly handles Prisma `BigInt` IDs across all responses without boilerplate serialization.

---

## Directory Layout

```
.
├── prisma/
│   ├── migrations/             # Versioned SQL migrations
│   └── schema.prisma           # Prisma schema definition
├── src/
│   ├── config/                 # Validated environment configuration (Zod)
│   ├── errors/                 # Domain & HTTP exceptions (AppError, NotFound, Conflict)
│   ├── modules/
│   │   └── urls/
│   │       ├── url.controller.js # HTTP request/response handlers
│   │       ├── url.events.js     # Click event builders
│   │       ├── url.redis.js      # Redis caching & queue publishers
│   │       ├── url.repository.js # Prisma database operations & analytics queries
│   │       ├── url.route.js      # REST API route declarations
│   │       ├── url.schema.js     # Fastify JSON validation schemas
│   │       └── url.service.js    # Core business logic & collision handling
│   ├── plugins/
│   │   ├── error-handler.js    # RFC-compliant central error handler
│   │   ├── prisma.js           # Prisma client lifecycle management
│   │   ├── rate-limit.js       # IP rate limiting
│   │   ├── redis.js            # Redis client lifecycle management
│   │   └── security.js         # Helmet security headers & CORS
│   ├── routes/
│   │   ├── health.routes.js    # /health & /health/ready probes
│   │   └── redirect.routes.js  # GET /:shortCode high-speed redirect
│   ├── utils/
│   │   ├── bigint.js           # Native BigInt JSON serializer
│   │   ├── encode.helper.js    # Base62 code generator & validator
│   │   └── url.validator.js    # SSRF guard & URL normalization
│   ├── workers/
│   │   └── url-click.worker.js # Production-grade batch click consumer
│   ├── app.js                  # Fastify application factory
│   └── server.js               # HTTP server entrypoint with graceful shutdown
├── tests/
│   └── api.test.js             # Comprehensive integration test suite
├── docker-compose.yml          # Postgres + Redis + API + Worker orchestration
├── Dockerfile                  # Multi-stage production container
└── package.json
```

---

## API Specification

### 1. Create Short URL
- **Endpoint**: `POST /api/v1/urls`
- **Headers**: `Content-Type: application/json`
- **Body**:
```json
{
  "originalUrl": "https://example.com/long-article",
  "customCode": "my-alias" // optional (3-30 chars)
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "1",
    "originalUrl": "https://example.com/long-article",
    "shortCode": "my-alias",
    "shortUrl": "http://localhost:3000/my-alias",
    "createdAt": "2026-11-17T10:00:00.000Z",
    "updatedAt": "2026-11-17T10:00:00.000Z"
  }
}
```

### 2. Redirect to Target URL
- **Endpoint**: `GET /:shortCode`
- **Response**: `302 Found` with `Location` header pointing to target URL.

### 3. Get URL Metadata
- **Endpoint**: `GET /api/v1/urls/:shortCode`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "1",
    "originalUrl": "https://example.com/long-article",
    "shortCode": "my-alias",
    "shortUrl": "http://localhost:3000/my-alias",
    "totalClicks": 12,
    "createdAt": "2026-11-17T10:00:00.000Z",
    "updatedAt": "2026-11-17T10:00:00.000Z"
  }
}
```

### 4. Get Detailed Analytics
- **Endpoint**: `GET /api/v1/urls/:shortCode/analytics`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "url": {
      "id": "1",
      "shortCode": "my-alias",
      "originalUrl": "https://example.com/long-article"
    },
    "analytics": {
      "totalClicks": 45,
      "clicksByDate": [
        { "date": "2026-11-17", "count": 30 },
        { "date": "2026-11-16", "count": 15 }
      ],
      "topReferrers": [
        { "referer": "https://twitter.com", "count": 28 },
        { "referer": "Direct", "count": 17 }
      ],
      "recentClicks": [
        {
          "id": "101",
          "clickedAt": "2026-11-17T10:25:00.000Z",
          "ipAddress": "198.51.100.42",
          "userAgent": "Mozilla/5.0 ...",
          "referer": "https://twitter.com"
        }
      ]
    }
  }
}
```

### 5. List URLs (Paginated)
- **Endpoint**: `GET /api/v1/urls?page=1&limit=20`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### 6. Delete Short URL
- **Endpoint**: `DELETE /api/v1/urls/:shortCode`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Short URL 'my-alias' successfully deleted"
  }
}
```

### 7. Health & Readiness Probes
- **Liveness Probe**: `GET /health` (Status 200)
- **Readiness Probe**: `GET /health/ready` (Status 200 if PostgreSQL and Redis are responsive; 503 if degraded)

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Redis 6+

### 1. Installation
```bash
git clone <repo-url>
cd url-shorts
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in credentials:
```bash
cp .env.example .env
```

### 3. Database Migration
```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Running the Application

**Development Server:**
```bash
npm run dev
```

**Background Click Worker:**
```bash
npm run worker:dev
```

**Production:**
```bash
npm start
npm run worker
```

### 5. Running Automated Tests
```bash
npm test
```

---

## Docker Deployment

To launch the complete infrastructure (PostgreSQL, Redis, Fastify API, and Click Worker) in isolated containers with healthchecks:

```bash
docker compose up -d --build
```


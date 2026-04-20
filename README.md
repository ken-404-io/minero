# Minero

Two independently-deployable apps:

```
minero/
├── backend/    Hono + Prisma + Neon Postgres (Node runtime)
└── frontend/   Next.js 16 (UI only; calls backend over HTTP)
```

The apps talk over HTTP with a session cookie. CORS is configured per-origin.

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL (Neon pooled URL) and JWT_SECRET (>=32 chars).
npm install
npm run db:generate
npm run db:migrate     # creates tables on Neon
npm run seed           # creates admin@minero.ph / admin123!
npm run dev            # starts on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
# .env.local defaults work if backend is on :4000 and frontend on :3000.
npm install
npm run dev            # starts on http://localhost:3000
```

Open http://localhost:3000.

## Environment variables

### `backend/.env`

| Name                | Required | Notes                                                           |
|---------------------|----------|-----------------------------------------------------------------|
| `DATABASE_URL`      | ✅       | Neon Postgres. Pooled URL for runtime, unpooled for migrations. |
| `JWT_SECRET`        | ✅       | ≥ 32 chars. `openssl rand -base64 48`.                          |
| `FRONTEND_ORIGIN`   | ✅       | Comma-separated allowed origins (no trailing slash).            |
| `PORT`              |          | Defaults to 4000.                                               |
| `NODE_ENV`          |          | `production` enables `Secure; SameSite=None` cookies.           |
| `COOKIE_DOMAIN`     |          | Set to `.example.com` if frontend + backend share a parent dom. |

### `frontend/.env.local`

| Name                   | Required | Notes                                                  |
|------------------------|----------|--------------------------------------------------------|
| `NEXT_PUBLIC_API_URL`  | ✅       | Browser-reachable backend URL.                         |
| `API_URL_INTERNAL`     |          | Server-side backend URL (if different from public).    |

## Deployment

The frontend and backend are deployed **separately**. A common combo:

### Backend → Railway / Render / Fly.io

- Service type: Node.
- Build command: `npm ci && npm run db:generate && npm run build`
- Start command: `npm run db:deploy && npm start`
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, `NODE_ENV=production`, `COOKIE_DOMAIN` (if using shared parent domain).

### Frontend → Vercel

- Root directory: `frontend`.
- Env vars: `NEXT_PUBLIC_API_URL` (backend public URL).
- Build command: `npm run build` (default).

### Cross-site cookies

When the frontend and backend live on different hosts, the session cookie is
set with `SameSite=None; Secure` in production. Both origins **must** be HTTPS
for browsers to accept the cookie. If the frontend and backend share a parent
domain (e.g. `app.example.com` + `api.example.com`), set
`COOKIE_DOMAIN=.example.com` for a cleaner cookie scope.

## Admin login (after seeding)

```
email:    admin@minero.ph
password: admin123!
```

**Change it before going live.**

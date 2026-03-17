# Setup & Start Guide

> Two ways to run WLD2Mpesa: **native** (Node.js directly) or **Docker**.
> Both support hot-reload in development.

---

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Node.js | 18 | `node -v` |
| npm | 9 | `npm -v` |
| Docker | 24 | `docker -v` |
| Docker Compose | v2 (plugin) | `docker compose version` |

---

## Option A — Native (no Docker)

Best for active development — fastest reload, easiest debugger access.

### 1. Copy environment files

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` and `frontend/.env.local`. 
Ensure `DATABASE_URL` is set in `backend/.env` (default: `file:./prisma/dev.db`).
The defaults work out of the box in simulation mode.

### 2. Install dependencies & Setup Database

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 3. Start — two terminals

**Terminal 1 — Backend** (port 3001, hot-reload via tsx watch):
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend** (port 3000, Vite HMR):
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** in your browser.

### 4. View logs

Logs are printed directly to each terminal.

Backend log format:
```
2026-03-04T09:00:00.000Z GET /api/health
[SIM] Payment initiated: TXN-1234-ABCD | KES 500 → 0.211532 WLD
[PIPELINE:TXN-1234-ABCD] Step 1: Waiting for WLD confirmation...
```

Frontend logs appear in the browser console **and** in the in-app Dev Mode panel
(tap the **DEV** button in the top-right corner of the home screen).

### 5. Run the end-to-end test (optional)

With the backend running, in a third terminal:
```bash
cd backend
npm run test:e2e
```

---

## Option B — Docker (Development)

Runs both services inside containers with live source mounts and hot-reload.
Ideal when you want an isolated environment that mirrors production more closely.

### 1. Copy environment files (same as native)

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
```

### 2. Build images and start

```bash
docker compose -f docker-compose.dev.yml up --build
```

Both services start in the foreground and log to the same terminal.

### 3. View logs

**Both services (interleaved, colour-coded by Docker):**
```bash
docker compose -f docker-compose.dev.yml logs -f
```

**Backend only:**
```bash
docker compose -f docker-compose.dev.yml logs -f backend
```

**Frontend only:**
```bash
docker compose -f docker-compose.dev.yml logs -f frontend
```

**Last 100 lines then follow:**
```bash
docker compose -f docker-compose.dev.yml logs --tail=100 -f
```

### 4. Hot-reload behaviour

| Service | Trigger | How |
|---------|---------|-----|
| Backend | Any `.ts` file change | `tsx watch` restarts the process automatically |
| Frontend | Any `.tsx/.css` file change | Vite HMR pushes the update to the browser |

### 5. Install a new npm package

```bash
# Backend
docker compose -f docker-compose.dev.yml exec backend npm install <package>

# Frontend
docker compose -f docker-compose.dev.yml exec frontend npm install <package>
```

### 6. Run Database Migrations (if needed)

If you modify the Prisma schema, run:
```bash
docker compose -f docker-compose.dev.yml exec backend npx prisma migrate dev
```

### 7. Stop

```bash
docker compose -f docker-compose.dev.yml down
```

Add `-v` to also remove the named volumes (wipes transaction data and node_modules):
```bash
docker compose -f docker-compose.dev.yml down -v
```

---

## Option C — Docker (Production)

Builds optimised multi-stage images.
- Backend: compiled TypeScript → Node.js
- Frontend: Vite build → nginx (also proxies `/api` to backend)

### 1. Set environment variables

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set real API keys and DATABASE_URL
```

To use a custom World App ID at build time:
```bash
export VITE_WLD_APP_ID=app_your_real_app_id
```

### 2. Build and start (detached)

```bash
docker compose up --build -d
```

The app is available at **http://localhost:3000**.
The backend is **not** directly exposed — all traffic goes through nginx.

### 3. View logs

**Both services:**
```bash
docker compose logs -f
```

**Backend only:**
```bash
docker compose logs -f backend
```

**Frontend (nginx) only:**
```bash
docker compose logs -f frontend
```

**Last N lines:**
```bash
docker compose logs --tail=50 -f backend
```

**Follow with timestamps:**
```bash
docker compose logs -f -t
```

### 4. Check service health

```bash
# Docker health status
docker compose ps

# Backend health endpoint
curl http://localhost:3000/api/health
```

Expected response:
```json
{ "status": "ok", "version": "1.0.0" }
```

### 5. Rebuild after code changes

```bash
docker compose up --build -d
```

Only the changed service is rebuilt (Docker layer cache).

### 6. Stop

```bash
docker compose down
```

---

## Transaction data (database)

Transactions are now managed via **Prisma ORM** and stored in a **SQLite** database file.

| Environment | Location |
|-------------|----------|
| Native dev | `backend/prisma/dev.db` |
| Docker dev | Named Docker volume `wld2mpesa_db_data` (mapped to `/app/prisma`) |
| Docker prod | Named Docker volume `wld2mpesa_db_data` (mapped to `/app/prisma`) |

**Inspect database directly:**
```bash
cd backend
npx prisma studio
```

**Back up database (Docker):**
```bash
docker cp wld2mpesa-backend:/app/prisma/dev.db ./backup-dev.db
```

**Wipe database (Docker dev):**
```bash
docker compose -f docker-compose.dev.yml down -v
```

**File format:**
```json
{
  "version": 1,
  "updatedAt": "2026-03-04T09:00:00.000Z",
  "transactions": [
    {
      "id": "TXN-1741082400000-A1B2",
      "status": "SETTLED",
      "kesAmount": 500,
      "tillNumber": "123456",
      "wldAmount": "0.211532",
      ...
    }
  ]
}
```

---

## URL reference

| URL | What it is |
|-----|-----------|
| http://localhost:3000 | Mini App (frontend) |
| http://localhost:3000/api/health | Health check (prod — proxied through nginx) |
| http://localhost:3001/api/health | Health check (dev — direct backend) |
| http://localhost:3001/api/rates/wld-kes | Live rate endpoint |

---

## Quick-command cheat sheet

```bash
# ── Native ──────────────────────────────────────────────────────────────────
npm run dev                   # (in backend/)  start backend with hot-reload
npm run dev                   # (in frontend/) start frontend with HMR
npm run test:e2e              # (in backend/)  simulate a full payment

# ── Docker dev ───────────────────────────────────────────────────────────────
docker compose -f docker-compose.dev.yml up --build     # start
docker compose -f docker-compose.dev.yml logs -f        # all logs
docker compose -f docker-compose.dev.yml logs -f backend # backend logs only
docker compose -f docker-compose.dev.yml down           # stop

# ── Docker prod ──────────────────────────────────────────────────────────────
docker compose up --build -d         # build + start in background
docker compose logs -f               # all logs
docker compose logs -f backend       # backend logs only
docker compose logs --tail=100 -f    # last 100 lines then follow
docker compose ps                    # service health status
docker compose down                  # stop (keeps volumes)
docker compose down -v               # stop + wipe volumes
```

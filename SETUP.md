# 🔗 ForensiChain — Quick Start Guide

> **ForensiChain** – Digital Evidence Integrity & Chain-of-Custody Platform  
> Cryptographic evidence management with tamper-proof audit trails.

---

## 📋 Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | ≥ 20.x | `node -v` |
| **npm** | ≥ 10.x | `npm -v` |
| **Git** | any | `git --version` |

You'll also need accounts for (already configured in `.env`):
- [MongoDB Atlas](https://cloud.mongodb.com) — Database
- [Upstash Redis](https://upstash.com) — Cache (REST-based)
- [AWS S3](https://aws.amazon.com/s3/) — Evidence file storage

---

## 🚀 Setup in 3 Steps

### Step 1 — Install Dependencies

```bash
# Frontend (root directory)
npm install

# Backend
cd backend
npm install
cd ..
```

### Step 2 — Configure Environment

```bash
# Copy the example env file
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your credentials:

```env
# MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/?appName=<app>

# Upstash Redis (REST API — NOT TCP)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# JWT secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<64-char-hex>
JWT_REFRESH_SECRET=<64-char-hex>

# AWS S3 (or use STORAGE_DRIVER=local for local filesystem)
STORAGE_DRIVER=s3
STORAGE_S3_BUCKET=your-bucket-name
STORAGE_S3_REGION=eu-north-1
STORAGE_S3_ACCESS_KEY=AKIA...
STORAGE_S3_SECRET_KEY=...

# Encryption key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=<64-char-hex>
```

### Step 3 — Verify & Launch

```bash
# Test all connections (MongoDB, Redis, S3)
cd backend
npm run test:connections
```

You should see:
```
✅ MongoDB connected – version 8.x
✅ Upstash Redis connected – PONG
✅ S3 bucket "..." accessible
🚀 All services operational!
```

Now start both servers:

```bash
# Terminal 1 — Backend (port 4000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 8080)
# (from project root)
npm run dev
```

Open **http://localhost:8080** in your browser.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Vite + React)               │
│                    http://localhost:8080                  │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Evidence  │  │  Cases   │  │  Audit   │  │  Auth  │  │
│  │ Upload/  │  │ Manage-  │  │  Logs &  │  │ Login/ │  │
│  │ Verify   │  │  ment    │  │ Reports  │  │Register│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       └──────────────┴─────────────┴────────────┘       │
│                         │ /api proxy                     │
└─────────────────────────┼───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend (Fastify + Node.js)             │
│                    http://localhost:4000                  │
│                                                         │
│  Auth ─── Evidence ─── Custody ─── Verification         │
│  Cases ── Ledger ───── Audit ───── Reports              │
│                                                         │
│  ┌───────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Crypto Engine │  │ Storage  │  │ Chain Validation │  │
│  │ AES-256-GCM  │  │ Engine   │  │ SHA-256 Hashing  │  │
│  │ Ed25519 Sigs │  │ Local/S3 │  │ Tamper Detection │  │
│  └───────┬───────┘  └────┬─────┘  └────────┬─────────┘  │
└──────────┼───────────────┼──────────────────┼───────────┘
           │               │                  │
     ┌─────▼─────┐  ┌─────▼─────┐  ┌────────▼────────┐
     │  MongoDB  │  │  AWS S3   │  │  Upstash Redis  │
     │  Atlas    │  │  Storage  │  │  (REST Cache)   │
     └───────────┘  └───────────┘  └─────────────────┘
```

---

## 📡 API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/login` | Login → access + refresh tokens |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Invalidate refresh token |
| `GET` | `/auth/me` | Get current user profile |

### Evidence
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/evidence/upload` | Upload & encrypt evidence file |
| `GET` | `/evidence` | List all evidence |
| `GET` | `/evidence/:id` | Get evidence details |
| `GET` | `/evidence/:id/download` | Download & decrypt file |
| `GET` | `/evidence/:id/verify` | Verify file integrity |
| `GET` | `/evidence/:id/timeline` | Get custody timeline |

### Cases
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/cases` | Create a case |
| `GET` | `/cases` | List cases |
| `GET` | `/cases/:id` | Get case details |

### Other
| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/custody/events` | List custody events |
| `POST` | `/custody/transfer` | Transfer evidence custody |
| `GET` | `/verification/:id/chain` | Verify chain integrity |
| `GET` | `/audit` | Audit logs |
| `GET` | `/ledger/anchors` | Ledger anchors |
| `GET` | `/reports/:id` | Generate PDF report |
| `GET` | `/health` | Health check |

---

## 🛠️ Available Scripts

### Backend (`cd backend`)

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Start with auto-reload |
| Production | `npm start` | Start without watch |
| Test connections | `npm run test:connections` | Verify MongoDB, Redis, S3 |
| Seed data | `npm run seed` | Populate test data |
| Ledger anchor | `npm run jobs:anchor` | Run ledger anchor manually |
| Integrity check | `npm run jobs:integrity` | Run integrity scan manually |
| Audit archive | `npm run jobs:archive` | Run audit archival manually |

### Frontend (project root)

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Start Vite dev server |
| Build | `npm run build` | Production build |
| Preview | `npm run preview` | Preview production build |
| Lint | `npm run lint` | Run ESLint |
| Test | `npm run test` | Run Vitest |

---

## 🔐 Security Features

- **AES-256-GCM** encryption for evidence files (authenticated encryption)
- **SHA-256** file hashing with tamper detection
- **Ed25519** digital signatures for evidence signing
- **JWT** access tokens (8h) + refresh tokens (7d) with rotation
- **RBAC** — Admin, Investigator, Auditor, Lab Technician roles
- **Rate limiting** — 60 req/min per IP
- **Helmet** security headers
- **CORS** locked to frontend URL in production
- **Cryptographic chain** — each custody event hash links to the previous

---

## 🗂️ Project Structure

```
trusty-chain-main/
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI components
│   ├── pages/              # Route pages
│   ├── services/api.ts     # API client with auto-refresh
│   ├── store/authStore.ts  # Auth state (Zustand + persist)
│   └── hooks/              # Custom React hooks
├── backend/
│   ├── .env                # Environment config
│   └── src/
│       ├── index.js         # Entry point
│       ├── core/            # Config, DB, Redis, Server
│       ├── crypto/          # AES-256-GCM, Ed25519, SHA-256
│       ├── forensics/       # Storage engine (Local / S3)
│       ├── models/          # Mongoose schemas
│       ├── services/        # Business logic
│       ├── controllers/     # Request handlers
│       ├── routes/          # API routes
│       ├── middleware/      # Auth, RBAC, Audit, Security
│       ├── jobs/            # CRON jobs
│       ├── ledger/          # Ledger anchoring
│       ├── validators/      # Zod schemas
│       └── utils/           # Logger, errors, helpers
├── vite.config.ts          # Vite config + API proxy
├── tailwind.config.ts      # Tailwind CSS config
└── package.json            # Frontend dependencies
```

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm.ps1 cannot be loaded` | Run: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| MongoDB connection timeout | Check your IP is whitelisted in Atlas → Network Access |
| Redis connection failed | Verify `UPSTASH_REDIS_REST_URL` starts with `https://` |
| S3 access denied | Check IAM credentials have `s3:PutObject`, `s3:GetObject`, `s3:HeadBucket` |
| Port 4000/8080 in use | Kill the process: `npx kill-port 4000 8080` |
| `jsx` warning in Vite | Already fixed — `esbuild.jsx: 'automatic'` in vite.config.ts |

---

<p align="center">
  <b>ForensiChain</b> · Digital Evidence Integrity · Built with 🔒
</p>

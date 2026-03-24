# 🛡️ CitySafe

> A community safety web application — report hazards, send SOS requests, and stay informed about what's happening around you.

[![CI](https://github.com/Notlikejoe/CitySafe/actions/workflows/ci.yml/badge.svg)](https://github.com/Notlikejoe/CitySafe/actions/workflows/ci.yml)

---

## What is CitySafe?

CitySafe is a full-stack prototype built by **ScriptSquad** that lets residents:

- 🗺️ View a **live safety map** — hazards, crowd density, safer routes, and accessibility resources
- 📋 **Submit hazard reports** (potholes, flooding, construction, etc.) with photo uploads
- 🆘 **Send SOS requests** with urgency levels and real-time broadcasts
- 🤝 Browse the **Community Feed** — see and respond to active alerts near you
- 🏆 Earn **CityPoints** for contributions and redeem vouchers
- ♿ Discover **accessibility resources** via OpenStreetMap (Overpass API)
- ⚙️ Manage notification and privacy **settings**, persisted to the backend

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TanStack Query, React Leaflet, Tailwind CSS |
| **Backend** | Node.js, Express, Socket.io (real-time SOS) |
| **Database** | PostgreSQL + PostGIS |
| **Auth** | JWT via HTTP-only cookies |
| **Testing** | Vitest (frontend), Jest (backend) |
| **CI** | GitHub Actions |

---

## Quick Start

> **Pre-requisite:** PostgreSQL must be running locally with PostGIS enabled.

### 1 — Clone the repo

```bash
git clone https://github.com/Notlikejoe/CitySafe.git
cd CitySafe/CitySafe-youssefs-design-and-prod
```

### 2 — Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL and JWT_SECRET
npm run dev               # starts on http://localhost:4001
```

### 3 — Frontend

```bash
cd frontend
npm install
cp .env.example .env      # set VITE_API_URL=http://localhost:4001/api
npm run dev               # starts on http://localhost:8888
```

Open **http://localhost:8888** in your browser.

### Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Demo User | `user_demo` | `demo1234` |
| Admin | `admin_01` | `admin1234` |

---

## Project Structure

```
CitySafe-youssefs-design-and-prod/
├── backend/                   # Express API + PostgreSQL
│   ├── features/              # Feature modules (reports, sos, community, accessibility…)
│   ├── scripts/               # DB init and maintenance utilities
│   ├── __tests__/             # Backend integration & unit tests
│   ├── server.js              # Express app entry point
│   ├── db.js                  # PostgreSQL connection pool
│   ├── init.sql               # Database schema (PostGIS)
│   └── README.md              # Full API contract →
│
└── frontend/                  # React + Vite SPA
    ├── src/
    │   ├── pages/             # MapPage, ReportPage, SosPage, CommunityPage…
    │   ├── hooks/             # React Query data hooks
    │   ├── services/          # Thin API wrappers
    │   ├── components/        # Sidebar + reusable UI components
    │   └── lib/               # Axios client + mock adapter
    └── README-frontend.md     # Frontend quick reference →
```

📖 **Full developer documentation:** [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md)

---

## API Overview

The backend exposes a REST API at `http://localhost:4001/api`. Key endpoint groups:

| Group | Base Path |
|-------|-----------|
| Auth | `/api/auth` |
| Reports | `/api/reports` |
| SOS | `/api/sos` |
| Community Feed ★ | `/api/community/feed` |
| Accessibility ★ | `/api/accessibility` |
| Crowd Density | `/api/crowd` |
| Points & Vouchers | `/api/users/:id/points`, `/api/vouchers` |
| Settings & History | `/api/users/:id/settings`, `/api/users/:id/history` |
| Uploads | `/api/upload` |

See [`backend/README.md`](./backend/README.md) for the complete API contract.

---

## Running Tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# Frontend production build
cd frontend && npm run build
```

---

## Environment Variables

### Backend (`.env`)

```env
PORT=4001
NODE_ENV=development
JWT_SECRET=replace-with-a-strong-secret
DATABASE_URL=postgres://<user>@localhost:5432/citysafe
```

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:4001/api
VITE_USE_MOCK=false
```

Set `VITE_USE_MOCK=true` to run the frontend with a built-in in-memory mock API — no backend required.

---

## Release Status

| Area | Status |
|------|--------|
| Prototype demonstration | ✅ Approved |
| Production deployment | ❌ Not yet approved |

> Performance, security, and end-to-end browser testing are still needed before production release. See [`DEVELOPER_GUIDE.md § Testing`](./DEVELOPER_GUIDE.md#16-testing) for full evaluation.

---

## Team

**ScriptSquad** — University of Birmingham, Software Engineering 2025–26

---

*For full developer documentation, architecture details, and contribution guidelines, see [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md).*

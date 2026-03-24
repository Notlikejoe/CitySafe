# CitySafe — Developer Guide

> **Branch:** `youssefs-design-and-prod` / `danielChanges`
> **Last updated:** March 2026
> This document is the single source of truth for any developer who wants to understand, run, or extend the CitySafe full-stack application.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Getting Started](#3-getting-started)
4. [Environment Variables](#4-environment-variables)
5. [Project Structure](#5-project-structure)
6. [Design System](#6-design-system)
7. [Shared UI Components](#7-shared-ui-components)
8. [Data Layer](#8-data-layer)
9. [Pages](#9-pages)
10. [Backend API Reference](#10-backend-api-reference)
11. [Feature Modules](#11-feature-modules)
12. [Mock API](#12-mock-api)
13. [Authentication](#13-authentication)
14. [Connecting to the Real Backend](#14-connecting-to-the-real-backend)
15. [Accessibility Standards](#15-accessibility-standards)
16. [Testing](#16-testing)
17. [Adding New Features](#17-adding-new-features)
18. [Git Workflow](#18-git-workflow)
19. [DevOps & Code Management](#19-devops--code-management)

---

## 1. Project Overview

CitySafe is a **full-stack** community safety web application. Residents can:
- View a live safety map with hazards, crowd zones, safe routes, and accessibility resources
- Submit safety reports (potholes, flooding, construction, etc.) with image uploads
- Send SOS requests with urgency levels and real-time Socket.io broadcasts
- Browse the **Community Feed** — a live feed of active SOS alerts and hazard reports nearby
- Track their history, earn CityPoints, and redeem vouchers
- Manage notification and privacy preferences (persisted to the backend)
- Discover nearby accessibility resources via the OpenStreetMap Overpass API

The **frontend** lives in `CitySafe-youssefs-design-and-prod/frontend/` and is a React SPA. It communicates with an Express/Node **backend** (`CitySafe-youssefs-design-and-prod/backend/`) backed by a **PostgreSQL** database with the PostGIS extension. The frontend also ships with a full **in-memory mock API** so it can run independently without the backend.

---

## 2. Tech Stack

### Frontend

| Concern | Library | Version |
|---------|---------|---------|
| UI framework | React | 18 |
| Routing | React Router DOM | v6 |
| Server-state | TanStack React Query | v5 |
| HTTP client | Axios | latest |
| Map | React Leaflet + Leaflet | latest |
| Icons | Lucide React | latest |
| Toast notifications | react-hot-toast | latest |
| CSS | Vanilla CSS + Tailwind CSS | v3 |
| Build tool | Vite | v7 |
| Testing | Vitest + React Testing Library | latest |

### Backend

| Concern | Library |
|---------|---------|
| Server | Express.js |
| Database | PostgreSQL + PostGIS |
| Real-time | Socket.io |
| Auth | JWT (cookie-based) + bcryptjs |
| File uploads | Multer (5 MB cap, PNG/JPEG/WEBP only) |
| Security | Helmet, express-rate-limit, cookie-parser |
| External APIs | OpenStreetMap Overpass (accessibility layer) |
| Testing | Jest / Vitest |

---

## 3. Getting Started

> ⚠️ **Pre-requisite:** PostgreSQL must be running locally with the PostGIS extension enabled. Update `DATABASE_URL` in `backend/.env` accordingly.

### Quick Run

Open two separate terminals:

**Terminal 1 — Backend** (runs on port **4001** by default):
```bash
cd CitySafe-youssefs-design-and-prod/backend
npm install
cp .env.example .env   # edit DATABASE_URL + JWT_SECRET
npm run dev
```

**Terminal 2 — Frontend** (runs on port **8888** by default, or force 5173):
```bash
cd CitySafe-youssefs-design-and-prod/frontend
npm install
cp .env.example .env
npm run dev
# or to pin the port:
npm run dev -- --port 5173
```

The app opens at **http://localhost:8888** (or **http://localhost:5173** if pinned).

### Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| **Demo User** | `user_demo` | `demo1234` |
| **Admin** | `admin_01` | `admin1234` |

### Build & Preview
```bash
# In frontend directory:
npm run build
npm run preview -- --port 4173
```

---

## 4. Environment Variables

### Backend — `backend/.env`

```env
PORT=4001
NODE_ENV=development
JWT_SECRET=replace-with-a-strong-secret
PERSIST_STORE=true
DATABASE_URL=postgres://<user>@localhost:5432/citysafe
```

> ⚠️ `JWT_SECRET` is **required** — the server throws at startup if it is missing.

### Frontend — `frontend/.env`

```env
# URL of the real backend API
VITE_API_URL=http://localhost:4001/api

# Set to "true" to use the built-in mock adapter instead of a real API
VITE_USE_MOCK=false
```

> ⚠️ **All Vite env vars must start with `VITE_`** to be accessible in browser code.
> Set `VITE_USE_MOCK=true` to run without a live backend.

---

## 5. Project Structure

```
CitySafe-youssefs-design-and-prod/
├── backend/
│   ├── __tests__/
│   │   ├── server.test.js         # Integration tests for API routes
│   │   └── accessibility.test.js  # Unit tests for accessibility feature
│   ├── features/
│   │   ├── accessibility.js       # ★ NEW — Overpass API + fallback + caching
│   │   ├── alerts.js              # Alert creation and retrieval
│   │   ├── crowd.js               # ★ UPDATED — Viewport-scoped, weighted density
│   │   ├── history.js             # Aggregated user activity history
│   │   ├── points.js              # CityPoints ledger and leaderboard
│   │   ├── reports.js             # Hazard report lifecycle
│   │   ├── search.js              # Full-text content search
│   │   ├── sos.js                 # SOS request lifecycle (PostGIS)
│   │   └── vouchers.js            # Voucher management and redemption
│   ├── db.js                      # ★ UPDATED — PostgreSQL pool (replaces SQLite)
│   ├── init.sql                   # ★ UPDATED — Database schema (PostGIS)
│   ├── server.js                  # ★ UPDATED — Express app, routes, Socket.io
│   ├── utils.js                   # Shared helpers (log, ok, err, isValidLocation)
│   ├── uploads/                   # Served at /uploads — auto-created on startup
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── Layout.jsx          # Root layout: desktop sidebar + mobile bottom nav
    │   │   └── leafletFix.js       # Fixes Leaflet's default icon URL issue
    │   │
    │   ├── components/
    │   │   ├── Sidebar.jsx         # ★ UPDATED — Navigation with Community link
    │   │   └── ui/                 # Reusable design-system components
    │   │       ├── Button.jsx
    │   │       ├── Card.jsx
    │   │       ├── Badge.jsx
    │   │       ├── Skeleton.jsx
    │   │       ├── EmptyState.jsx
    │   │       ├── ErrorBanner.jsx
    │   │       ├── Modal.jsx
    │   │       └── StatusTimeline.jsx
    │   │
    │   ├── contexts/
    │   │   └── AuthContext.jsx     # ★ UPDATED — Cookie-based JWT auth context
    │   │
    │   ├── hooks/                  # React Query data hooks (one file per domain)
    │   │   ├── useCommunity.js     # ★ NEW — Feed query + responder mutations
    │   │   ├── useGeolocation.js   # ★ UPDATED — Geolocation hook
    │   │   ├── useOfflineQueue.js  # ★ UPDATED — Offline queue management
    │   │   ├── useReports.js       # ★ UPDATED
    │   │   ├── useSettings.js      # ★ UPDATED — Persists to backend
    │   │   ├── useSettings.test.jsx # ★ NEW — Settings hook tests
    │   │   ├── useSocket.js        # ★ UPDATED — Socket.io connection hook
    │   │   ├── useSos.js           # ★ UPDATED
    │   │   ├── useAlerts.js
    │   │   ├── useHistory.js
    │   │   ├── usePoints.js
    │   │   └── useVouchers.js
    │   │
    │   ├── lib/
    │   │   ├── apiClient.js        # ★ UPDATED — Axios instance (cookie auth)
    │   │   └── mockAdapter.js      # ★ UPDATED — Full in-memory mock API
    │   │
    │   ├── pages/                  # One file per route
    │   │   ├── CommunityPage.jsx   # ★ NEW — /community — Live SOS + hazard feed
    │   │   ├── MapPage.jsx         # ★ UPDATED — /  (Accessibility lens added)
    │   │   ├── ReportPage.jsx      # ★ UPDATED — /report
    │   │   ├── ReportPage.test.jsx # ★ NEW — Report page tests
    │   │   ├── SettingsPage.jsx    # ★ UPDATED — /settings (persisted)
    │   │   └── SosPage.jsx         # ★ UPDATED — /sos
    │   │
    │   ├── services/               # Thin API call wrappers (no state logic)
    │   │   ├── communityService.js # ★ NEW — getFeed, respond
    │   │   ├── reportsService.js   # ★ UPDATED
    │   │   ├── sosService.js       # ★ UPDATED
    │   │   ├── alertsService.js
    │   │   ├── historyService.js
    │   │   ├── pointsService.js
    │   │   └── vouchersService.js
    │   │
    │   ├── test/
    │   │   └── setupTests.js       # ★ NEW — Vitest global test setup
    │   │
    │   ├── App.jsx                 # ★ UPDATED — Router + routes (Community added)
    │   ├── main.jsx                # Entry point: QueryClientProvider + Toaster
    │   ├── index.css               # Design tokens + global animations
    │   └── App.css                 # Root element reset
    │
    ├── .env / .env.example
    ├── vite.config.js              # ★ UPDATED — Vitest config included
    └── package.json                # ★ UPDATED
```

---

## 6. Design System

All design tokens are defined as **CSS custom properties** in `src/index.css`. Do not hardcode colors or spacing — always reference tokens.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--cs-teal-500` | `#14b8a6` | Primary brand, active states |
| `--cs-teal-600` | `#0d9488` | Hover, sidebar active |
| `--cs-sky-400` | `#38bdf8` | Secondary accent, report markers |
| `--cs-slate-50` | `#f8fafc` | Page background |
| `--cs-slate-900` | `#0f172a` | Headings |
| `--cs-emergency` | `#dc2626` | **SOS page only** — do not use elsewhere |
| `--cs-amber-400` | `#fbbf24` | Points, warnings |

> **Rule:** Emergency red (`--cs-emergency`) is intentionally isolated to the SOS page only. Do not use it for regular UI states — this prevents alarm fatigue in daily use.

### Typography

- Font: **Inter** (loaded from Google Fonts in `index.css`)
- Headings: `font-extrabold` / `font-bold`
- Body: `text-sm` / `text-base`
- Meta / labels: `text-xs font-semibold uppercase tracking-widest`

### Animations (CSS classes)

| Class | Effect |
|-------|--------|
| `.animate-fade-up` | Fade + slide up on mount (stagger with `animationDelay`) |
| `.animate-fade-in` | Simple fade on mount |
| `.animate-sos-pulse` | Red glow pulse — SOS send button at high urgency |
| `.animate-badge-pulse` | Amber glow pulse — "Pending" status badges |
| `.animate-ring` | SVG circle draw animation — progress ring |
| `.hover-lift` | 2px lift + shadow on hover (add to interactive cards) |
| `.ticket-glass` | Glassmorphic ticket with shimmer sweep |
| `.skeleton` | Shimmer loading placeholder |

---

## 7. Shared UI Components

All in `src/components/ui/`. Import like:
```js
import { Button } from "../components/ui/Button";
```

### `Button`
```jsx
<Button variant="primary" size="md" loading={false} onClick={...}>Label</Button>
```
**Variants:** `primary` | `secondary` | `ghost` | `danger` | `emergency`
**Sizes:** `sm` | `md` | `lg`
**Notes:** `emergency` variant uses `--cs-emergency` red. Only use on SOS page.

### `Card`
```jsx
<Card className="p-4" hoverable>Content</Card>
```
White rounded-2xl surface. Add `hoverable` for lift on hover.

### `Badge`
```jsx
<Badge status="submitted" />   // or "verified", "pending", "high", "medium", "low", etc.
```
Automatically picks colour based on status string.

### `Skeleton` / `CardSkeleton` / `ListSkeleton`
```jsx
<ListSkeleton count={4} />
```
Use these as loading states before data arrives.

### `EmptyState`
```jsx
<EmptyState icon={FileWarning} heading="Nothing here" body="..." actionLabel="Do something" onAction={fn} />
```

### `ErrorBanner`
```jsx
<ErrorBanner message={error.message} onRetry={refetch} />
```

### `Modal`
```jsx
<Modal open={isOpen} onClose={close} title="Confirm">
  ...content...
</Modal>
```
Accessible: closes on backdrop click and Escape key.

### `StatusTimeline`
```jsx
<StatusTimeline history={report.statusHistory} />
```
Renders a vertical timeline of status changes. Accepts the `statusHistory` array from a report or SOS object.

---

## 8. Data Layer

### Architecture

```
Page/Hook
  └── React Query hook  (src/hooks/)
        └── Service function  (src/services/)
              └── apiClient  (src/lib/apiClient.js)
                    └── Real Axios  OR  mockRequest()  (src/lib/mockAdapter.js)
```

### `apiClient.js`

This is the single HTTP layer. It reads `VITE_USE_MOCK` at startup:
- If `true` → all requests are intercepted and routed to `mockAdapter.js`
- If `false` → requests go to `VITE_API_URL` with standard Axios and `withCredentials: true` (for cookie-based auth)

**Auth:** The backend now uses **HTTP-only cookies** (`cs_token`) instead of `localStorage`. The `apiClient` sends `withCredentials: true` so cookies are forwarded automatically. You no longer manually read or write `localStorage` for auth.

### Services (`src/services/`)

Thin wrappers — **no state logic**. They only define the URL shapes:

```js
// Example: communityService.js (NEW)
export const communityService = {
  getFeed: (params) => apiClient.get("/community/feed", { params }),
  respond:  (id, type, body) => apiClient.post(`/community/${type}/${id}/respond`, body),
};
```

### React Query Hooks (`src/hooks/`)

Use these in pages/components — they handle caching, loading, error state, and cache invalidation automatically.

**Query hooks (read data):**
```js
const { data, isLoading, isError, refetch } = useNearbyReports(lat, lng, radius);
const { data: feed } = useCommunityFeed();   // ★ NEW
const { data: points } = usePoints(userId);
```

**Mutation hooks (write data):**
```js
const { mutate: createReport, isPending } = useCreateReport();
const { mutate: respond } = useCommunityRespond();  // ★ NEW
```

**`useCommunity.js` specifics:**
- Auto-refetches the community feed every **15 seconds** for near-real-time updates
- Exposes a `respond` mutation that invalidates the feed cache on success

All mutations:
1. Show a `react-hot-toast` notification on success/error
2. Call `queryClient.invalidateQueries(...)` to refresh related queries automatically

**Global QueryClient config** (in `main.jsx`):
- `retry: 2` — failed requests retry twice automatically
- `staleTime: 30_000` — cached data is considered fresh for 30 seconds

---

## 9. Pages

### `MapPage` — `/`

- Full-screen Leaflet map with OpenStreetMap HOT tile layer
- **Safety Lens switcher**: Hazards / Crowds / Heat / **Accessibility** ★ (desktop toolbar, mobile bottom sheet)
- Live report markers from `useNearbyReports`
- Active alert counter from `useAlertsFeed`
- Bottom sheet panels for: hazard details, crowd zones, safer route, active alerts, **accessibility resources** ★
- Floating buttons: Report → `/report`, Safer Route, SOS → `/sos`

**Accessibility Lens:** When activated, the map calls `GET /api/accessibility` and renders markers for health facilities, safety resources, accessible infrastructure, and environmental amenities. Falls back to hardcoded demo resources if the Overpass API is unavailable.

**To change the map center:** Edit `const CENTER = [lat, lon]` at the top of `MapPage.jsx`.

### `CommunityPage` — `/community` ★ NEW

A **live community feed** showing active SOS requests and hazard reports nearby.

- **Tab filters:** All / SOS / Hazard Reports
- Each card shows: type icon + emoji, description, urgency badge, location, time elapsed
- **Respond flow** — community members can offer help on open SOS/report items
- **Resolve flow** — item owners can mark their own requests as resolved
- Auto-refreshes every **15 seconds** via `useCommunity` hook
- Empty state handles "all clear" when no active items exist

### `ReportPage` — `/report`

- `fieldset`/`legend` type picker (6 categories)
- Real geolocation via `useGeolocation` hook
- Image upload via `POST /api/upload` — returns a hosted URL
- Textarea with 10-char minimum validation
- On submit: `useCreateReport` mutation → success card + toast

**To add a new report type:** Add an entry to the `REPORT_TYPES` array at the top of the file.

### `SosPage` — `/sos`

- **Intentional visual hierarchy:** Medical is full-width (most critical), Car + Electrician side-by-side, Other as minimal link
- Urgency slider (Low / Medium / High) — changes color dynamically, triggers pulse animation at High
- Emergency red styling **only activates at High urgency + SOS context**
- Confirmation modal before sending (prevents accidental taps)
- On confirm: `useCreateSos` mutation → Socket.io broadcast → success state

**To add a new SOS type:** Add to the `SOS_TYPES` array. Set `full: true` for a full-width card.

### `SettingsPage` — `/settings`

- Toggle switches are now **persisted to the backend** via `useSettings` hook ★
- Settings are fetched on mount and patched on each toggle change
- Graceful fallback to local state if the backend is unavailable (mock mode)

### `DashboardPage` — `/dashboard`

- **Greeting** is time-aware: "Good morning / afternoon / evening" based on `new Date().getHours()`
- **Progress Ring**: SVG circle animation, driven by `usePoints(userId).data.balance`
- **Glass Tickets**: horizontal scroll of vouchers from `useVouchers(userId)`
- **Timeline Feed**: items from `useHistory(userId, params)` — each item must have `_type` and `_timestamp`
- **Filter tabs**: pass `{ type: "report" | "sos" | "point" | "voucher" }` as params to `useHistory`

---

## 10. Backend API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | Public | Login — sets `cs_token` HTTP-only cookie |
| `POST` | `/api/auth/logout` | Auth | Clears the auth cookie |
| `GET`  | `/api/auth/me` | Auth | Returns current user profile |

### Reports

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/reports?lat=&lng=&radius=` | Auth | Nearby reports |
| `POST` | `/api/reports` | Auth | Create hazard report (awards CityPoints) |
| `GET`  | `/api/reports/:id` | Auth | Single report |
| `PATCH`| `/api/reports/:id/status` | Auth | Update status |
| `DELETE`| `/api/reports/:id` | Owner/Admin | Delete report |
| `POST` | `/api/reports/:id/verify` | Admin | Verify report |
| `POST` | `/api/reports/:id/reject` | Admin | Reject report |

### SOS Requests

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/sos` | Auth | Active SOS requests |
| `POST` | `/api/sos` | Auth | Create SOS (rate-limited: 10/10min; broadcasts via Socket.io) |
| `GET`  | `/api/sos/:id` | Auth | Single SOS request |
| `PATCH`| `/api/sos/:id/status` | Auth | Update SOS status |

### Community Feed ★ NEW

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/community/feed` | Auth | Merged + sorted SOS + hazard feed |
| `POST` | `/api/community/sos/:id/respond` | Auth | Respond to an SOS request |
| `POST` | `/api/community/report/:id/respond` | Auth | Respond to a hazard report |

### Accessibility ★ NEW

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/accessibility?lat=&lon=&radius=` | Auth | Resources from Overpass API (cached, with fallback) |

### Crowd Density

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/crowd?lat=&lng=&radius=` | Auth | Viewport-scoped crowd heatmap zones |

### Points & Vouchers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/users/:id/points` | Owner/Admin | Points balance |
| `GET`  | `/api/users/:id/points/ledger` | Owner/Admin | Points history |
| `GET`  | `/api/leaderboard` | Auth | Top users by points |
| `GET`  | `/api/users/:id/vouchers` | Owner/Admin | User vouchers |
| `POST` | `/api/vouchers/:id/redeem` | Auth | Redeem a voucher |

### Users & History

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/users/:id/reports` | Owner/Admin | Reports by user |
| `GET`  | `/api/users/:id/sos` | Owner/Admin | SOS requests by user |
| `GET`  | `/api/users/:id/history?type=&page=&limit=` | Owner/Admin | Aggregated timeline |
| `PATCH`| `/api/users/:id/settings` | Owner | Persist settings |

### Uploads & Utilities

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/upload` | Auth | Upload image (PNG/JPEG/WEBP, max 5 MB) |
| `GET`  | `/api/health` | Public | Health check |
| `GET`  | `/api/search?q=` | Auth | Full-text search across reports |

### History endpoint shape

The `/api/users/:id/history` endpoint tags each timeline item with:
```json
{ "_type": "report" | "sos" | "point" | "voucher", "_timestamp": "ISO 8601 string", ...originalFields }
```
The Dashboard timeline depends on these two fields for color coding and sorting.

---

## 11. Feature Modules

### `features/accessibility.js` ★ NEW

Fetches nearby accessibility resources from the **OpenStreetMap Overpass API** and groups them into four categories:

| Category | Example resources |
|----------|-------------------|
| `health` | Hospitals, pharmacies, first-aid boxes |
| `safety` | Police stations, emergency services |
| `accessibility` | Wheelchair ramps, accessible parking, toilets |
| `environmental` | Parks, benches, drinking water |

**Resilience:**
- Results are **cached in memory** (TTL: 5 minutes) per bounding box
- If Overpass is unavailable or times out, the module returns a **hardcoded fallback** set of demo resources
- Tested in `__tests__/accessibility.test.js`

### `features/crowd.js` ★ UPDATED

Derives crowd/heat density from **live internal incident data** (reports + SOS) using PostGIS:

- Queries are **scoped to the current map viewport** when lat/lon are provided
- SOS urgency weights: `high = 3.0`, `medium = 2.0`, `low = 1.0`
- Grid-based density with **neighbour-cell smoothing** and **distance-based decay**
- Final intensities are **normalized to 0..1** for stable frontend rendering
- Falls back to an empty array if the database query fails

### `features/reports.js` ★ UPDATED

- Full CRUD lifecycle for hazard reports
- Awards CityPoints automatically on successful report creation
- Admin `verify` / `reject` transitions
- Owner `cancel` route

### `features/sos.js` ★ UPDATED

- SOS creation stores location using **PostGIS geography** type
- Status machine: `pending → under_review → resolved / cancelled`
- Socket.io event `sos:new` is broadcast to all connected clients on creation

### `features/points.js` ★ UPDATED

- Ledger-based points system — every award is recorded individually
- Supports leaderboard queries against the PostgreSQL database

---

## 12. Mock API

`src/lib/mockAdapter.js` is a complete in-memory API. Enable it with `VITE_USE_MOCK=true`.

### What it provides

| Endpoint | Data |
|----------|------|
| `GET /reports` | 2 seeded reports (pothole + flooding) |
| `POST /reports` | Creates report in memory, returns it |
| `GET /alerts`, `/alerts/feed` | 2 active alerts |
| `POST /sos` | Creates SOS request, returns with `status: "pending"` |
| `GET /community/feed` | Merged mock feed of SOS + reports ★ |
| `GET /users/:id/history` | Aggregated reports + SOS + points + vouchers, sorted by time |
| `GET /users/:id/points` | Returns `{ balance: 50, earned: 50, redeemed: 0 }` |
| `GET /users/:id/vouchers` | 1 active voucher `CSV-DEMO1234` |
| `POST /vouchers/:id/redeem` | Marks voucher as redeemed |

### Adding a new mock route

```js
// In mockAdapter.js, add a key to the handlers object:
"GET /your/endpoint": async ({ params }) => {
  await delay();
  return wrap({ someData: "value" });
},
```

Pattern matching is handled by `routeMatch()` — `:param` segments are extracted automatically. Data persists **in memory only** — a page refresh resets the store.

---

## 13. Authentication

The backend uses **HTTP-only cookie-based JWT auth**.

### Login flow

```
POST /api/auth/login  { userId, password }
→ Server sets cs_token cookie (HTTP-only, Secure in production)
→ Frontend receives { userId, role } in response body
→ AuthContext stores role in React state
```

### API requests

`apiClient.js` sends `withCredentials: true` on all requests — the browser automatically attaches the `cs_token` cookie. **Do not store the token in `localStorage`.**

### Logout

```
POST /api/auth/logout
→ Server clears the cookie
→ AuthContext resets state
→ React Router redirects to login
```

### Protected routes

All API routes (except `/api/health` and `/api/auth/login`) require a valid cookie. The `requireAuth` middleware verifies the JWT and attaches `req.user = { userId, role }`.

Resource ownership is enforced by `requireOwnerOrAdmin` — users can only access their own data unless they have the `admin` role.

---

## 14. Connecting to the Real Backend

1. Set `VITE_USE_MOCK=false` in `frontend/.env`
2. Set `VITE_API_URL=http://localhost:4001/api`
3. Ensure PostgreSQL is running with the CitySafe schema applied (`backend/init.sql`)
4. Start the backend with `npm run dev`
5. CORS is pre-configured for `localhost:3000`, `localhost:5173`, and `localhost:8888`

---

## 15. Accessibility Standards

The codebase follows these rules — please maintain them when adding features:

| Rule | Implementation |
|------|----------------|
| All form inputs have associated labels | `htmlFor` on `<label>` matches `id` on `<input>` |
| Button groups use `fieldset`/`legend` | See ReportPage type picker |
| Toggle buttons expose state | `aria-pressed={isActive}` on segmented controls |
| Decorative icons are hidden | `aria-hidden="true"` on all icons that have adjacent text |
| Error messages are announced | `role="alert"` on validation error paragraphs |
| Modals trap focus | Escape key + backdrop click both close Modal |
| Interactive elements have unique IDs | Prefix IDs with page name: `report-description`, `urgency-range` |
| Status badges pulse for pending only | `.animate-badge-pulse` only when `status === "pending"` |

---

## 16. Testing

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Frontend production build validation
cd frontend && npm run build
```

### CI Pipeline

The GitHub Actions workflow runs on every push:
```
Code → Backend Tests → Backend Lint → Frontend Tests → Frontend Build
```

### Test Coverage

| Area | Framework | Location |
|------|-----------|----------|
| Backend API routes | Jest | `backend/__tests__/server.test.js` |
| Accessibility feature | Jest | `backend/__tests__/accessibility.test.js` |
| Settings hook | Vitest + RTL | `frontend/src/hooks/useSettings.test.jsx` |
| Report page | Vitest + RTL | `frontend/src/pages/ReportPage.test.jsx` |

### Testing Philosophy

Testing for CitySafe is conducted to **increase confidence in system behaviour**, not to prove complete correctness. Coverage is focused on:
- High-risk features (auth, SOS, uploads)
- Common user flows (report creation, feed browsing)
- Representative valid and invalid inputs
- Edge cases that could expose instability

### Test Results Summary

| Area | Status |
|------|--------|
| Backend tests | ✅ All passed |
| Frontend tests | ✅ All passed |
| Integration flows | ⚠️ Mostly working; some browser-level checks still pending |

### Release Status

| Status | Verdict |
|--------|---------|
| Prototype demonstration | ✅ Approved |
| Production deployment | ❌ Not approved |

**Reasons for limited production readiness:**
- Performance validation is limited to prototype-scale local usage
- Security has not been formally penetration-tested
- The Accessibility feature depends on external Overpass API availability
- Full browser-level end-to-end validation is not yet complete

---

## 17. Adding New Features

### Adding a new page

1. Create `src/pages/YourPage.jsx`
2. Add a route in `src/App.jsx`:
   ```jsx
   <Route path="/your-path" element={<YourPage />} />
   ```
3. Add a nav item in `src/components/Sidebar.jsx` inside the `navItems` array
4. If the page needs data, add: service → hook → use in your page

### Adding a new service + hook

```js
// src/services/yourService.js
import { apiClient } from "../lib/apiClient";
export const yourService = {
  getAll: () => apiClient.get("/your-endpoint"),
};

// src/hooks/useYour.js
import { useQuery } from "@tanstack/react-query";
import { yourService } from "../services/yourService";
export const useYour = () =>
  useQuery({
    queryKey: ["your", "key"],
    queryFn: () => yourService.getAll().then((r) => r.data),
    staleTime: 30_000,
  });
```

### Adding a new backend feature

1. Create `backend/features/yourFeature.js`
2. Export your handler functions
3. Import and wire routes in `backend/server.js`
4. Add the new schema if needed to `backend/init.sql`
5. Add tests in `backend/__tests__/yourFeature.test.js`

### Adding a new UI component

1. Create `src/components/ui/YourComponent.jsx`
2. Use existing design tokens (no hardcoded colors)
3. Add `aria-*` attributes as appropriate
4. Export as named export: `export function YourComponent(...)`

---

## 18. Git Workflow

Active branches:
- **`youssefs-design-and-prod`** — UI/design baseline
- **`danielChanges`** — feature additions (Community, Accessibility, tests, etc.)
- **`main`** — stable baseline

```bash
# Sync latest from remote
git fetch origin
git pull origin youssefs-design-and-prod

# Create a feature branch
git checkout -b feature/your-feature-name youssefs-design-and-prod

# After your changes
git add -A
git commit -m "feat: short description of what you did"
git push -u origin feature/your-feature-name

# Open a PR → youssefs-design-and-prod (not main)
```

### Commit message conventions

```
feat:     New feature
fix:      Bug fix
style:    CSS / visual change only (no logic change)
refactor: Code restructure (no behavior change)
chore:    Build, deps, tooling
a11y:     Accessibility improvement
test:     Adding or updating tests
```

---

## 19. DevOps & Code Management

### Current CI/CD State

```
Code → Backend Tests → Backend Lint → Frontend Tests → Frontend Build
```

Gaps identified:
- No deployment stage
- No database migration automation
- No artifact publishing or rollback automation
- No post-deploy validation or smoke checks

**Continuous Integration** is partially established. **Continuous Delivery/Deployment** is not yet established.

### DevOps Maturity

| Area | Score |
|------|-------|
| DevOps Adoption | `5/10` |
| Automation Level | `5/10` |
| Code Management Quality | `6/10` |
| Deployment Readiness | `3/10` |

### Known Risks

| Risk | Detail |
|------|--------|
| `backend/server.js` hotspot | High merge conflict risk — further modularisation needed |
| External API dependency | Overpass downtime degrades the Accessibility lens |
| No monitoring/alerting | Failures detectable only via manual log inspection |
| No deployment pipeline | Releases depend on manual setup; prone to config drift |

### Recommended Improvements

1. Add deployment and post-deploy validation workflows (GitHub Actions)
2. Modularise `backend/server.js` into a router-per-feature pattern
3. Introduce metrics and alerting for critical routes and external dependencies
4. Standardise environment setup through scripts or containerisation (Docker Compose)
5. Add trunk-based development with PR gates and semantic version tags

---

*For database schema details, see `backend/init.sql`. For quick startup instructions, see `running.md`.*

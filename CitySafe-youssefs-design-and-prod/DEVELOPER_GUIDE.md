# CitySafe — Developer Guide

> **Branch:** `youssefs-design-and-prod`  
> **Last updated:** February 2026  
> This document is the single source of truth for any developer who wants to understand, run, or extend the CitySafe frontend.

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
10. [Mock API](#10-mock-api)
11. [Connecting to the Real Backend](#11-connecting-to-the-real-backend)
12. [Accessibility Standards](#12-accessibility-standards)
13. [Adding New Features](#13-adding-new-features)
14. [Git Workflow](#14-git-workflow)

---

## 1. Project Overview

CitySafe is a community safety web application. Residents can:
- View a live safety map with hazards, crowd zones, and suggested safe routes
- Submit safety reports (potholes, flooding, construction, etc.)
- Send SOS requests with urgency levels
- Track their history, earn CityPoints, and redeem vouchers
- Manage notification and privacy preferences

The **frontend** lives in `c:\CItySafe\frontend` and is a React SPA. It communicates with an Express/Node backend (`c:\CItySafe\backend`), but also ships with a full **in-memory mock API** so the frontend can run independently without the backend.

---

## 2. Tech Stack

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
| Linter | ESLint | latest |

---

## 3. Getting Started

```powershell
# Install dependencies
cd c:\CItySafe\frontend
npm install

# Start dev server (hot reload on port 5173)
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

The app opens at **http://localhost:5173**.

---

## 4. Environment Variables

Create a `.env` file in `c:\CItySafe\frontend\` (copy from `.env.example`):

```env
# URL of the real backend API
VITE_API_URL=http://localhost:4000

# Set to "true" to use the built-in mock adapter instead of a real API
VITE_USE_MOCK=true
```

> ⚠️ **All Vite env vars must start with `VITE_`** to be accessible in browser code.  
> Change `VITE_USE_MOCK=false` when you want to talk to the real backend.

---

## 5. Project Structure

```
frontend/
├── public/                    # Static assets
├── src/
│   ├── app/
│   │   ├── Layout.jsx         # Root layout: desktop sidebar + mobile bottom nav
│   │   └── leafletFix.js      # Fixes Leaflet's default icon URL issue
│   │
│   ├── components/
│   │   ├── Sidebar.jsx        # Navigation (desktop collapsible + mobile bar)
│   │   └── ui/                # Reusable design-system components
│   │       ├── Button.jsx
│   │       ├── Card.jsx
│   │       ├── Badge.jsx
│   │       ├── Skeleton.jsx
│   │       ├── EmptyState.jsx
│   │       ├── ErrorBanner.jsx
│   │       ├── Modal.jsx
│   │       └── StatusTimeline.jsx
│   │
│   ├── hooks/                 # React Query data hooks (one file per domain)
│   │   ├── useReports.js
│   │   ├── useAlerts.js
│   │   ├── useSos.js
│   │   ├── useHistory.js
│   │   ├── usePoints.js
│   │   └── useVouchers.js
│   │
│   ├── lib/
│   │   ├── apiClient.js       # Axios instance — switches between real/mock
│   │   └── mockAdapter.js     # Full in-memory mock API
│   │
│   ├── pages/                 # One file per route
│   │   ├── MapPage.jsx        # /
│   │   ├── ReportPage.jsx     # /report
│   │   ├── SosPage.jsx        # /sos
│   │   ├── DashboardPage.jsx  # /dashboard
│   │   └── SettingsPage.jsx   # /settings
│   │
│   ├── services/              # Thin API call wrappers (no state logic here)
│   │   ├── reportsService.js
│   │   ├── alertsService.js
│   │   ├── sosService.js
│   │   ├── historyService.js
│   │   ├── pointsService.js
│   │   └── vouchersService.js
│   │
│   ├── App.jsx                # Router + routes
│   ├── main.jsx               # Entry point: QueryClientProvider + Toaster
│   ├── index.css              # Design tokens + global animations
│   └── App.css                # Root element reset
│
├── .env                       # Local env vars (not committed)
├── .env.example               # Template — commit this, not .env
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
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

### Corner Radius Convention

- Hero / large sections: `rounded-3xl`
- Cards, inputs, buttons: `rounded-2xl`
- Chips, badges, pills: `rounded-full`
- Do **not** use the same radius everywhere — intentional variation creates visual hierarchy.

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
- If `false` → requests go to `VITE_API_URL` with standard Axios

**Auth:** The request interceptor reads `localStorage.getItem("cs_token")` and attaches it as a Bearer token. To add authentication, just write the token to `localStorage` under the key `cs_token` after a successful login.

### Services (`src/services/`)

Thin wrappers — **no state logic**. They only define the URL shapes:

```js
// Example: reportsService.js
export const reportsService = {
  getNearby: (lat, lng, radius) => apiClient.get("/reports", { params: { lat, lng, radius } }),
  getById:   (id)               => apiClient.get(`/reports/${id}`),
  getByUser: (userId)           => apiClient.get(`/users/${userId}/reports`),
  create:    (payload)          => apiClient.post("/reports", payload),
  updateStatus: (id, status, actorId) => apiClient.patch(`/reports/${id}/status`, { status, actorId }),
};
```

### React Query Hooks (`src/hooks/`)

Use these in pages/components — they handle caching, loading, error state, and cache invalidation automatically.

**Query hooks (read data):**
```js
const { data, isLoading, isError, refetch } = useNearbyReports(lat, lng, radius);
const { data: points } = usePoints(userId);
const { data: history } = useHistory(userId, { type: "report", page: 1, limit: 20 });
```

**Mutation hooks (write data):**
```js
const { mutate: createReport, isPending } = useCreateReport();
createReport(payload, { onSuccess: (data) => ..., onError: (e) => ... });
```

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
- **Safety Lens switcher**: Hazards / Crowds / Heat / Accessibility (desktop toolbar, mobile bottom sheet)
- Live report markers from `useNearbyReports`
- Active alert counter from `useAlertsFeed`
- Bottom sheet panels for: hazard details, crowd zones, safer route, active alerts
- Floating buttons: Report → `/report`, Safer Route, SOS → `/sos`

**To change the map center:** Edit `const CENTER = [lat, lon]` at the top of `MapPage.jsx`.

### `ReportPage` — `/report`

- `fieldset`/`legend` type picker (6 categories)
- Location display (currently mocked — wire to `navigator.geolocation` for production)  
- Textarea with 10-char minimum validation
- Optional image URL field
- On submit: `useCreateReport` mutation → success card + toast

**To add a new report type:** Add an entry to the `REPORT_TYPES` array at the top of the file.

### `SosPage` — `/sos`

- **Intentional visual hierarchy:** Medical is full-width (most critical), Car + Electrician side-by-side, Other as minimal link
- Urgency slider (Low / Medium / High) — changes color dynamically, triggers pulse animation at High
- Emergency red styling **only activates at High urgency + SOS context**
- Confirmation modal before sending (prevents accidental taps)
- On confirm: `useCreateSos` mutation → success state

**To add a new SOS type:** Add to the `SOS_TYPES` array. Set `full: true` for a full-width card.

### `DashboardPage` — `/dashboard`

- **Greeting** is time-aware: "Good morning / afternoon / evening" based on `new Date().getHours()`
- **Progress Ring**: SVG circle animation, driven by `usePoints(userId).data.balance`
- **Glass Tickets**: horizontal scroll of vouchers from `useVouchers(userId)`
- **Timeline Feed**: items from `useHistory(userId, params)` — each item must have `_type` and `_timestamp` (the mock and the backend history endpoint both attach these)
- **Filter tabs**: pass `{ type: "report" | "sos" | "point" | "voucher" }` as params to `useHistory`

**Current mock user:** `MOCK_USER_ID = "user_demo"` — replace with your auth session user ID.

### `SettingsPage` — `/settings`

- Toggle switches are local state only (`useState`) — **not yet persisted to backend**
- To persist, call a `PATCH /users/:id/settings` endpoint inside each toggle's `onChange`

---

## 10. Mock API

`src/lib/mockAdapter.js` is a complete in-memory API. Enable it with `VITE_USE_MOCK=true`.

### What it provides

| Endpoint | Data |
|----------|------|
| `GET /reports` | 2 seeded reports (pothole + flooding) |
| `POST /reports` | Creates report in memory, returns it |
| `GET /alerts`, `/alerts/feed` | 2 active alerts (flooding + construction) |
| `POST /sos` | Creates SOS request, returns with `status: "pending"` |
| `GET /users/:id/history` | Aggregated reports + SOS + points + vouchers, sorted by time |
| `GET /users/:id/points` | Returns `{ balance: 50, earned: 50, redeemed: 0 }` |
| `GET /users/:id/vouchers` | 1 active voucher `CSV-DEMO1234` |
| `POST /vouchers/:id/redeem` | Marks voucher as redeemed |

### Adding mock data

Open `mockAdapter.js` and add entries to the `store` object at the top. The `genId()` helper generates unique IDs. Data persists **in memory only** — a page refresh resets the store.

### Adding a new mock route

```js
// In the relevant handler object, add a new key:
"GET /users/:id/newfeature": async ({ id, params }) => {
  await delay();
  return wrap({ someData: "value" });
},
```

Pattern matching is handled by `routeMatch()` — `:param` segments are extracted automatically.

---

## 11. Connecting to the Real Backend

1. Set `VITE_USE_MOCK=false` in `.env`
2. Set `VITE_API_URL=http://your-backend-host:4000`
3. Ensure the backend is running and CORS allows `http://localhost:5173`

### Expected API contract

The frontend expects JSON responses wrapped in `{ data: ... }` (standard Axios response shape). All endpoints are:

```
GET    /reports?lat=&lng=&radius=
POST   /reports
GET    /reports/:id
PATCH  /reports/:id/status
GET    /users/:id/reports
GET    /alerts
GET    /alerts/feed
POST   /alerts
GET    /sos/:id
POST   /sos
PATCH  /sos/:id/status
GET    /users/:id/sos
GET    /users/:id/history?type=&page=&limit=
GET    /users/:id/points
GET    /users/:id/points/ledger
GET    /users/:id/vouchers
POST   /vouchers/:id/redeem
```

### History endpoint shape

The `/users/:id/history` endpoint must tag each item with:
```json
{ "_type": "report" | "sos" | "point" | "voucher", "_timestamp": "ISO 8601 string", ...originalFields }
```
The Dashboard timeline depends on these two fields to determine color coding and sorting.

### Authentication

The `apiClient` reads `localStorage.getItem("cs_token")` and sends it as:
```
Authorization: Bearer <token>
```
After a user logs in, write the token: `localStorage.setItem("cs_token", token)`.  
On logout, remove it: `localStorage.removeItem("cs_token")`.

---

## 12. Accessibility Standards

The codebase follows these rules — please maintain them when adding features:

| Rule | Implementation |
|------|---------------|
| All form inputs have associated labels | `htmlFor` on `<label>` matches `id` on `<input>` |
| Button groups use `fieldset`/`legend` | See ReportPage type picker |
| Toggle buttons expose state | `aria-pressed={isActive}` on segmented controls |
| Decorative icons are hidden | `aria-hidden="true"` on all icons that have adjacent text |
| Error messages are announced | `role="alert"` on validation error paragraphs |
| Modals trap focus | Escape key + backdrop click both close Modal |
| Interactive elements have unique IDs | Prefix IDs with page name: `report-description`, `urgency-range`, `sos-desc` |
| Status badges pulse for pending only | `.animate-badge-pulse` only when `status === "pending"` |

---

## 13. Adding New Features

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

### Adding a new UI component

1. Create `src/components/ui/YourComponent.jsx`
2. Use existing design tokens (no hardcoded colors)
3. Add `aria-*` attributes as appropriate
4. Export as named export: `export function YourComponent(...)`

---

## 14. Git Workflow

The active development branch is **`youssefs-design-and-prod`**.  
`main` is the stable baseline.

```powershell
# Sync latest from remote
git fetch origin
git pull origin youssefs-design-and-prod

# Create a feature branch off the dev branch
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
```

---

*For backend architecture, database schema, and API documentation, see `c:\CItySafe\backend\README.md` (if it exists) or contact the backend team.*

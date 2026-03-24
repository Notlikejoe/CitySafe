# CitySafe — Frontend

React + Vite SPA for the CitySafe community safety application.

## Quick Start

```bash
npm install
cp .env.example .env   # configure VITE_API_URL and VITE_USE_MOCK
npm run dev            # starts on http://localhost:8888 (or 5173 if forced)
```

To force port 5173:
```bash
npm run dev -- --port 5173
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend base URL | `http://localhost:4001/api` |
| `VITE_USE_MOCK` | Use in-memory mock API instead of real backend | `false` |

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | `MapPage` | Live safety map (Hazards / Crowds / Heat / Accessibility lenses) |
| `/report` | `ReportPage` | Submit a hazard report with image upload |
| `/sos` | `SosPage` | Send an SOS request |
| `/community` | `CommunityPage` ★ | Live feed of active SOS + hazard reports |
| `/dashboard` | `DashboardPage` | Points, vouchers, and activity timeline |
| `/settings` | `SettingsPage` | Notification and privacy preferences |

## Testing

```bash
npm test          # run Vitest tests
npm run build     # production build (also validates TypeScript / JSX)
```

Test files:
- `src/pages/ReportPage.test.jsx`
- `src/hooks/useSettings.test.jsx`
- `src/test/setupTests.js` — global Vitest configuration

## Key New Features (danielChanges)

- **Community Page** — Live feed of SOS requests and hazard reports with respond/resolve flows
- **Accessibility Map Lens** — Renders Overpass API resources (health, safety, accessible infra)
- **Cookie-based Auth** — `apiClient` now uses `withCredentials: true`; no `localStorage` token handling
- **Persisted Settings** — Settings are fetched from and written to the backend via `useSettings`
- **useCommunity hook** — Auto-refreshes every 15 seconds for near-real-time feed updates

## Architecture

For full documentation, see `DEVELOPER_GUIDE.md` in the project root.

```
src/
├── app/            # Layout shell + Leaflet fix
├── components/     # Sidebar + reusable UI components
├── contexts/       # AuthContext (cookie-based JWT)
├── hooks/          # React Query data hooks (one per domain)
├── lib/            # apiClient (Axios) + mockAdapter
├── pages/          # One file per route
├── services/       # Thin API wrappers (no state)
└── test/           # Test setup
```

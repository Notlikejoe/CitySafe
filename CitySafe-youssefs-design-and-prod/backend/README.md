# CitySafe Backend API Contract

All endpoints run on `http://localhost:4001` by default (configurable via `PORT` in `.env`).

> **Database:** PostgreSQL + PostGIS (not SQLite)
> **Auth:** HTTP-only JWT cookie (`cs_token`) — include `withCredentials: true` on all requests

---

## Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | Public | `{ userId, password, displayName }` → sets cookie |
| `POST` | `/api/auth/login` | Public | `{ userId, password }` → sets cookie |
| `POST` | `/api/auth/logout` | Auth | Clears the `cs_token` cookie |
| `GET`  | `/api/auth/me` | Auth | Returns current user payload |

---

## Protected Endpoints

All routes below require a valid `cs_token` cookie. The server rejects requests with `401` if the cookie is missing or invalid.

### Reports

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/reports?lat=&lon=&radius=` | Any | Nearby reports (returns all if no coords) |
| `POST` | `/api/reports` | Any | Create report. `multipart/form-data` with `image` file OR JSON `{ type, description, location }` |
| `GET`  | `/api/reports/:id` | Any | Fetch a specific report |
| `PATCH`| `/api/reports/:id/status` | Admin | Transition report status `{ status }` |
| `POST` | `/api/reports/:id/verify` | Admin | Formally verify a report |
| `POST` | `/api/reports/:id/reject` | Admin | Reject a report |
| `DELETE`| `/api/reports/:id` | Owner/Admin | Delete a report |
| `GET`  | `/api/users/:id/reports` | Owner/Admin | History of reports for user `:id` |

### SOS Requests

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/sos` | Any | Trigger SOS. `{ type, location, urgency }`. Broadcasts `sos:new` via Socket.io |
| `GET`  | `/api/sos` | Any | Get active SOS requests |
| `GET`  | `/api/sos/:id` | Any | View a specific SOS request |
| `PATCH`| `/api/sos/:id/status` | Owner/Admin | Update status (`pending → under_review → resolved / cancelled`) |
| `GET`  | `/api/users/:id/sos` | Owner/Admin | User's SOS history |

### Community Feed ★ NEW

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/community/feed` | Any | Merged, time-sorted feed of active SOS requests and hazard reports |
| `POST` | `/api/community/sos/:id/respond` | Any | Offer help on an SOS request |
| `POST` | `/api/community/report/:id/respond` | Any | Respond to a hazard report |

### Alerts

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/alerts?lat=&lon=&radius=` | Any | Active alerts within radius |
| `GET`  | `/api/alerts/feed` | Any | Chronological alerts (add `?includeExpired=true`) |
| `POST` | `/api/alerts` | Admin | Issue a global alert |
| `PATCH`| `/api/alerts/:id` | Admin | Force-deactivate an alert |

### Accessibility ★ NEW

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/accessibility?lat=&lon=&radius=` | Any | Nearby accessibility resources (Overpass API + fallback) |

Resources are grouped into: `health`, `safety`, `accessibility`, `environmental`.
Results are cached for 5 minutes per bounding box. Falls back to demo data if Overpass is unavailable.

### Crowd Density

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/crowd?lat=&lng=&radius=` | Any | Viewport-scoped heatmap zones derived from active incidents |

Intensity values are normalized to `0..1`. SOS urgency is weighted: high=3.0, medium=2.0, low=1.0.

### Points, Vouchers & Leaderboard

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/users/:id/points` | Owner/Admin | Points balance |
| `GET`  | `/api/users/:id/points/ledger` | Owner/Admin | Ledger of point transactions |
| `POST` | `/api/users/:id/points` | Admin | Manual point award |
| `GET`  | `/api/leaderboard` | Any | Top users by points |
| `GET`  | `/api/users/:id/vouchers` | Owner/Admin | User's earned vouchers |
| `POST` | `/api/vouchers/:id/redeem` | Owner | Redeem a voucher |

### Settings & History

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/users/:id/settings` | Owner | Fetch user settings |
| `PATCH`| `/api/users/:id/settings` | Owner | Persist settings preferences |
| `GET`  | `/api/users/:id/history?type=&page=&limit=` | Owner/Admin | Paged unified activity stream |

Each history item is tagged with `_type: "report" | "sos" | "point" | "voucher"` and `_timestamp` (ISO 8601).

### Uploads & Utilities

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/upload` | Auth | Upload image (PNG/JPEG/WEBP, max 5 MB). Returns `{ url: "/uploads/<filename>" }` |
| `GET`  | `/api/health` | Public | Health check |
| `GET`  | `/api/search?q=` | Auth | Full-text search across reports |

Static uploads are served at `/uploads/<filename>` with cross-origin headers.

---

## Rate Limits

| Limiter | Window | Max Requests |
|---------|--------|--------------|
| Global | 15 min | 100 per IP |
| Auth (`/api/auth/*`) | 15 min | 20 per IP |
| SOS (`/api/sos`) | 10 min | 10 per IP |

---

## Real-time (Socket.io)

The server broadcasts `sos:new` with the full SOS payload to all connected clients when a new SOS request is created. Connect to the Socket.io server at `http://localhost:4001`.

```js
import { io } from "socket.io-client";
const socket = io("http://localhost:4001", { withCredentials: true });
socket.on("sos:new", (sos) => console.log("New SOS:", sos));
```

---

*For full developer documentation, see `DEVELOPER_GUIDE.md` in the project root.*

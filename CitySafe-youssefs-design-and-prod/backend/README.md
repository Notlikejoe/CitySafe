# CitySafe Backend API Contract

All endpoints run on `http://localhost:4000`.

## Authentication & Users
- `POST /api/auth/register` - Takes `{ userId, password, displayName }`. Returns JWT token.
- `POST /api/auth/login` - Takes `{ userId, password }`. Returns JWT token.
- `GET /api/auth/me` - Validates token and returns current user payload.

## Protected Endpoints
**Require Header:** `Authorization: Bearer <token>`

### Reports
- `GET /api/reports?lat=X&lon=Y&radius=Z` - Get nearby reports. (Returns all if no coordinates)
- `POST /api/reports` - Creates a report. Expects `multipart/form-data` with `image` (file) or JSON `{ type, description, location }`.
- `GET /api/reports/:id` - Fetch specific report.
- `PATCH /api/reports/:id/status` - (Admin only) Transitions report status. Expects `{ status }`.
- `POST /api/reports/:id/verify` - (Admin only) Formally verifies a review state.
- `POST /api/reports/:id/reject` - (Admin only) Rejects a review state.
- `GET /api/users/:id/reports` - History of reports for `id`.

### SOS
- `POST /api/sos` - Trigger SOS. Overwrites previous active SOS for the same user. Ex: `{ type, location, urgency }`
- `GET /api/sos/:id` - View an SOS.
- `PATCH /api/sos/:id/status` - Update status. (Admin, or User if cancelling)
- `GET /api/users/:id/sos` - User's previous SOS signals.

### Alerts
- `GET /api/alerts?lat=X&lon=Y&radius=Z` - Fetch active community alerts within radial distance.
- `GET /api/alerts/feed` - Fetch all chronological alerts, pass `?includeExpired=true` to include dead alerts.
- `POST /api/alerts` - (Admin only) Issue global alert.
- `PATCH /api/alerts/:id` - (Admin only) Force deactivate.

### Points, Vouchers, Settings & History
- `GET /api/users/:id/points` - Gets point balance.
- `GET /api/users/:id/points/ledger` - Ledger of transactions.
- `POST /api/users/:id/points` - (Admin only) Manual award.
- `GET /api/users/:id/vouchers` - View earned vouchers.
- `POST /api/vouchers/:id/redeem` - Redeem standard voucher.
- `GET /api/users/:id/history` - Paged, unified stream combining reports + SOS + points.
- `GET /api/users/:id/settings` - Fetches settings state.
- `PATCH /api/users/:id/settings` - Merges preference updates.

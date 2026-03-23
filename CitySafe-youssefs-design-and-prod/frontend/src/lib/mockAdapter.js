/**
 * CitySafe Mock Adapter — Rich Demo Dataset
 * Activated when VITE_USE_MOCK=true in .env
 * Contains 20+ reports, 5 alerts, 3 SOS, points history, 3 vouchers
 * for a compelling presentation experience.
 */

// ─── In-memory store ─────────────────────────────────────────────────────────
const store = {
    reports: [
        // ── Potholes ──
        {
            id: "r1", userId: "user_demo", type: "pothole",
            location: { lat: 25.2055, lon: 55.2720 },
            description: "Large pothole near the fountain roundabout causing tyre damage",
            imageRef: null, status: "verified",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-18T10:00:00Z", by: "user_demo" },
                { from: "submitted", to: "under_review", at: "2026-02-18T10:30:00Z", by: "admin_01" },
                { from: "under_review", to: "verified", at: "2026-02-18T11:00:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-18T10:00:00Z", updatedAt: "2026-02-18T11:00:00Z",
        },
        {
            id: "r2", userId: "user_b", type: "pothole",
            location: { lat: 25.2100, lon: 55.2780 },
            description: "Deep pothole on the service road, about 30cm wide",
            imageRef: null, status: "under_review",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-20T08:00:00Z", by: "user_b" },
                { from: "submitted", to: "under_review", at: "2026-02-20T09:00:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-20T08:00:00Z", updatedAt: "2026-02-20T09:00:00Z",
        },
        // ── Flooding ──
        {
            id: "r3", userId: "user_demo", type: "flooding",
            location: { lat: 25.2080, lon: 55.2735 },
            description: "Street flooding after last night's rain — water reaches knee level",
            imageRef: null, status: "submitted",
            statusHistory: [{ from: null, to: "submitted", at: "2026-02-22T08:00:00Z", by: "user_demo" }],
            createdAt: "2026-02-22T08:00:00Z", updatedAt: "2026-02-22T08:00:00Z",
        },
        {
            id: "r4", userId: "user_c", type: "flooding",
            location: { lat: 25.1980, lon: 55.2660 },
            description: "Underpass flooded, vehicles stuck and unable to pass through",
            imageRef: null, status: "verified",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-21T14:00:00Z", by: "user_c" },
                { from: "submitted", to: "under_review", at: "2026-02-21T14:45:00Z", by: "admin_01" },
                { from: "under_review", to: "verified", at: "2026-02-21T15:00:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-21T14:00:00Z", updatedAt: "2026-02-21T15:00:00Z",
        },
        // ── Construction ──
        {
            id: "r5", userId: "user_d", type: "construction",
            location: { lat: 25.2090, lon: 55.2750 },
            description: "Unmarked construction site blocking main pavement, no signage",
            imageRef: null, status: "verified",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-19T09:00:00Z", by: "user_d" },
                { from: "submitted", to: "under_review", at: "2026-02-19T09:30:00Z", by: "admin_01" },
                { from: "under_review", to: "verified", at: "2026-02-19T10:00:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-19T09:00:00Z", updatedAt: "2026-02-19T10:00:00Z",
        },
        {
            id: "r6", userId: "user_e", type: "construction",
            location: { lat: 25.2035, lon: 55.2690 },
            description: "Road narrowed to single lane with no advance warning signs",
            imageRef: null, status: "submitted",
            statusHistory: [{ from: null, to: "submitted", at: "2026-02-22T11:00:00Z", by: "user_e" }],
            createdAt: "2026-02-22T11:00:00Z", updatedAt: "2026-02-22T11:00:00Z",
        },
        // ── Fire ──
        {
            id: "r7", userId: "user_demo", type: "fire",
            location: { lat: 25.2130, lon: 55.2810 },
            description: "Electrical fire in apartment block lobby, fire brigade called",
            imageRef: null, status: "resolved",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-17T22:00:00Z", by: "user_demo" },
                { from: "submitted", to: "under_review", at: "2026-02-17T22:05:00Z", by: "admin_01" },
                { from: "under_review", to: "verified", at: "2026-02-17T22:10:00Z", by: "admin_01" },
                { from: "verified", to: "resolved", at: "2026-02-17T23:00:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-17T22:00:00Z", updatedAt: "2026-02-17T23:00:00Z",
        },
        {
            id: "r8", userId: "user_f", type: "fire",
            location: { lat: 25.2010, lon: 55.2700 },
            description: "Rubbish bin fire spreading to nearby bushes on the corniche",
            imageRef: null, status: "under_review",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-22T07:30:00Z", by: "user_f" },
                { from: "submitted", to: "under_review", at: "2026-02-22T08:00:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-22T07:30:00Z", updatedAt: "2026-02-22T08:00:00Z",
        },
        // ── Crime ──
        {
            id: "r9", userId: "user_g", type: "crime",
            location: { lat: 25.2060, lon: 55.2760 },
            description: "Suspicious individual attempting car door handles in parking lot B",
            imageRef: null, status: "submitted",
            statusHistory: [{ from: null, to: "submitted", at: "2026-02-22T01:15:00Z", by: "user_g" }],
            createdAt: "2026-02-22T01:15:00Z", updatedAt: "2026-02-22T01:15:00Z",
        },
        {
            id: "r10", userId: "user_h", type: "crime",
            location: { lat: 25.2150, lon: 55.2720 },
            description: "Bag snatch reported outside the metro station exit",
            imageRef: null, status: "verified",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-21T20:00:00Z", by: "user_h" },
                { from: "submitted", to: "under_review", at: "2026-02-21T20:30:00Z", by: "admin_01" },
                { from: "under_review", to: "verified", at: "2026-02-21T21:00:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-21T20:00:00Z", updatedAt: "2026-02-21T21:00:00Z",
        },
        // ── Other ──
        {
            id: "r11", userId: "user_i", type: "other",
            location: { lat: 25.1960, lon: 55.2730 },
            description: "Broken streetlight leaving pedestrian underpass completely dark",
            imageRef: null, status: "verified",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-20T18:00:00Z", by: "user_i" },
                { from: "submitted", to: "under_review", at: "2026-02-20T18:30:00Z", by: "admin_01" },
                { from: "under_review", to: "verified", at: "2026-02-20T19:00:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-20T18:00:00Z", updatedAt: "2026-02-20T19:00:00Z",
        },
        {
            id: "r12", userId: "user_demo", type: "other",
            location: { lat: 25.2115, lon: 55.2695 },
            description: "Manhole cover missing on busy footpath near the park entrance",
            imageRef: null, status: "submitted",
            statusHistory: [{ from: null, to: "submitted", at: "2026-02-22T09:00:00Z", by: "user_demo" }],
            createdAt: "2026-02-22T09:00:00Z", updatedAt: "2026-02-22T09:00:00Z",
        },
        {
            id: "r13", userId: "user_j", type: "pothole",
            location: { lat: 25.2070, lon: 55.2650 },
            description: "Multiple small potholes along bike lane, dangerous for cyclists",
            imageRef: null, status: "under_review",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-21T07:00:00Z", by: "user_j" },
                { from: "submitted", to: "under_review", at: "2026-02-21T08:00:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-21T07:00:00Z", updatedAt: "2026-02-21T08:00:00Z",
        },
        {
            id: "r14", userId: "user_k", type: "flooding",
            location: { lat: 25.2040, lon: 55.2800 },
            description: "Burst pipe flooding residential street, water main needs urgent repair",
            imageRef: null, status: "verified",
            statusHistory: [
                { from: null, to: "submitted", at: "2026-02-22T06:30:00Z", by: "user_k" },
                { from: "submitted", to: "under_review", at: "2026-02-22T07:00:00Z", by: "admin_01" },
                { from: "under_review", to: "verified", at: "2026-02-22T07:30:00Z", by: "admin_01" },
            ],
            createdAt: "2026-02-22T06:30:00Z", updatedAt: "2026-02-22T07:30:00Z",
        },
        {
            id: "r15", userId: "user_l", type: "construction",
            location: { lat: 25.2160, lon: 55.2760 },
            description: "Scaffolding extending too far into road, motorists unable to pass",
            imageRef: null, status: "submitted",
            statusHistory: [{ from: null, to: "submitted", at: "2026-02-22T10:00:00Z", by: "user_l" }],
            createdAt: "2026-02-22T10:00:00Z", updatedAt: "2026-02-22T10:00:00Z",
        },
    ],

    alerts: [
        {
            id: "a1", type: "flooding", priority: "high",
            location: { lat: 25.2048, lon: 55.2708 },
            message: "Flash flooding risk near marina district. Avoid low-lying roads.",
            createdBy: "system", active: true,
            createdAt: "2026-02-22T06:00:00Z", expiresAt: "2026-02-29T06:00:00Z",
        },
        {
            id: "a2", type: "construction", priority: "medium",
            location: { lat: 25.2090, lon: 55.2750 },
            message: "Road works on main boulevard northbound. Expect 20-min delays.",
            createdBy: "system", active: true,
            createdAt: "2026-02-21T09:00:00Z", expiresAt: "2026-03-05T09:00:00Z",
        },
        {
            id: "a3", type: "crime", priority: "high",
            location: { lat: 25.2060, lon: 55.2760 },
            message: "Elevated crime activity near parking lot B. Travel in groups after dark.",
            createdBy: "system", active: true,
            createdAt: "2026-02-22T02:00:00Z", expiresAt: "2026-02-24T02:00:00Z",
        },
        {
            id: "a4", type: "weather", priority: "medium",
            location: { lat: 25.2048, lon: 55.2708 },
            message: "Sandstorm advisory in effect until 18:00. Limit outdoor activity.",
            createdBy: "system", active: true,
            createdAt: "2026-02-22T08:00:00Z", expiresAt: "2026-02-22T20:00:00Z",
        },
        {
            id: "a5", type: "fire", priority: "low",
            location: { lat: 25.2010, lon: 55.2700 },
            message: "Controlled rubbish fire near corniche extinguished. No further risk.",
            createdBy: "system", active: true,
            createdAt: "2026-02-22T09:30:00Z", expiresAt: "2026-02-23T09:30:00Z",
        },
    ],

    sosRequests: [
        {
            id: "s1", userId: "user_demo", type: "medical",
            location: { lat: 25.2062, lon: 55.2732 },
            urgency: "high", description: "Elderly person collapsed near bus stop",
            status: "resolved",
            statusHistory: [
                { from: null, to: "pending", at: "2026-02-19T15:00:00Z", by: "user_demo" },
                { from: "pending", to: "responding", at: "2026-02-19T15:03:00Z", by: "responder_01" },
                { from: "responding", to: "resolved", at: "2026-02-19T15:18:00Z", by: "responder_01" },
            ],
            createdAt: "2026-02-19T15:00:00Z", updatedAt: "2026-02-19T15:18:00Z",
        },
        {
            id: "s2", userId: "user_demo", type: "car_trouble",
            location: { lat: 25.2095, lon: 55.2755 },
            urgency: "medium", description: "Flat tyre on the bypass road, need help",
            status: "resolved",
            statusHistory: [
                { from: null, to: "pending", at: "2026-02-21T11:00:00Z", by: "user_demo" },
                { from: "pending", to: "responding", at: "2026-02-21T11:10:00Z", by: "responder_02" },
                { from: "responding", to: "resolved", at: "2026-02-21T11:30:00Z", by: "responder_02" },
            ],
            createdAt: "2026-02-21T11:00:00Z", updatedAt: "2026-02-21T11:30:00Z",
        },
        // ── Active / pending SOS (shown in Community feed) ──
        {
            id: "s3", userId: "user_c", type: "medical",
            location: { lat: 25.2075, lon: 55.2745 },
            urgency: "high", description: "Child having severe allergic reaction, no EpiPen available",
            status: "pending",
            statusHistory: [{ from: null, to: "pending", at: "2026-03-22T19:45:00Z", by: "user_c" }],
            createdAt: "2026-03-22T19:45:00Z", updatedAt: "2026-03-22T19:45:00Z",
        },
        {
            id: "s4", userId: "user_d", type: "car_trouble",
            location: { lat: 25.2040, lon: 55.2695 },
            urgency: "medium", description: "Car battery dead on the main highway slip road, blocking traffic",
            status: "pending",
            statusHistory: [{ from: null, to: "pending", at: "2026-03-22T20:10:00Z", by: "user_d" }],
            createdAt: "2026-03-22T20:10:00Z", updatedAt: "2026-03-22T20:10:00Z",
        },
        {
            id: "s5", userId: "user_e", type: "electrician",
            location: { lat: 25.2110, lon: 55.2762 },
            urgency: "low", description: "Power cut in residential apartment, fuse box sparking",
            status: "under_review",
            statusHistory: [
                { from: null, to: "pending", at: "2026-03-22T20:30:00Z", by: "user_e" },
                { from: "pending", to: "under_review", at: "2026-03-22T20:35:00Z", by: "responder_01" },
            ],
            createdAt: "2026-03-22T20:30:00Z", updatedAt: "2026-03-22T20:35:00Z",
        },
    ],

    pointsLedger: [
        { id: "p1", userId: "user_demo", points: 50, reason: "report_verified", referenceId: "r1", timestamp: "2026-02-18T11:00:00Z" },
        { id: "p2", userId: "user_demo", points: 50, reason: "report_verified", referenceId: "r3", timestamp: "2026-02-22T08:30:00Z" },
        { id: "p3", userId: "user_demo", points: 25, reason: "sos_resolved", referenceId: "s1", timestamp: "2026-02-19T15:20:00Z" },
        { id: "p4", userId: "user_demo", points: 50, reason: "report_verified", referenceId: "r7", timestamp: "2026-02-17T23:00:00Z" },
        { id: "p5", userId: "user_demo", points: 25, reason: "sos_resolved", referenceId: "s2", timestamp: "2026-02-21T11:30:00Z" },
        { id: "p6", userId: "user_demo", points: 50, reason: "report_verified", referenceId: "r12", timestamp: "2026-02-22T09:30:00Z" },
    ],

    vouchers: [
        {
            id: "v1", userId: "user_demo", code: "CSV-XTRA50",
            title: "50% off at Carrefour",
            description: "Redeem at any Carrefour branch in Dubai Marina",
            pointsCost: 100,
            issuedAt: "2026-02-18T12:00:00Z", expiresAt: "2026-03-22T12:00:00Z",
            redeemed: false, redeemedAt: null,
        },
        {
            id: "v2", userId: "user_demo", code: "CSV-CAFE20",
            title: "Free coffee at Costa",
            description: "One free regular-sized coffee at Costa Coffee",
            pointsCost: 75,
            issuedAt: "2026-02-19T09:00:00Z", expiresAt: "2026-03-19T09:00:00Z",
            redeemed: false, redeemedAt: null,
        },
        {
            id: "v3", userId: "user_demo", code: "CSV-PARK15",
            title: "15 AED parking credit",
            description: "Applied automatically at any RTA smart parking bay",
            pointsCost: 50,
            issuedAt: "2026-02-20T10:00:00Z", expiresAt: "2026-02-28T10:00:00Z",
            redeemed: true, redeemedAt: "2026-02-21T08:30:00Z",
        },
    ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
let idCounter = 200;
const genId = () => `mock_${++idCounter}`;
const now = () => new Date().toISOString();
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const wrap = (data) => ({ data });
const DEMO_USER = { userId: "user_demo", role: "user", name: "Demo User", email: "demo@citysafe.app", displayName: "Demo User" };

// ─── Reports ──────────────────────────────────────────────────────────────────
const reportsHandlers = {
    "GET /reports": async ({ params }) => {
        await delay();
        return wrap(store.reports);
    },
    "POST /reports": async ({ data }) => {
        await delay();
        const report = {
            id: genId(), userId: data.userId ?? "user_demo",
            type: data.type, location: data.location,
            description: data.description, imageRef: data.imageUrl ?? data.imageRef ?? null, imageUrl: data.imageUrl ?? data.imageRef ?? null,
            status: "submitted",
            statusHistory: [{ from: null, to: "submitted", at: now(), by: data.userId ?? "user_demo" }],
            createdAt: now(), updatedAt: now(),
        };
        store.reports.push(report);
        return wrap(report);
    },
    "GET /reports/:id": async ({ id }) => {
        await delay(200);
        const report = store.reports.find((r) => r.id === id);
        if (!report) throw { response: { data: { error: "Report not found" }, status: 404 } };
        return wrap(report);
    },
    "PATCH /reports/:id/status": async ({ id, data }) => {
        await delay();
        const report = store.reports.find((r) => r.id === id);
        if (!report) throw { response: { data: { error: "Report not found" }, status: 404 } };
        const prev = report.status;
        report.status = data.status;
        report.updatedAt = now();
        report.statusHistory.push({ from: prev, to: data.status, at: now(), by: data.actorId ?? "admin_01" });
        return wrap(report);
    },
    "PATCH /reports/:id/resolve": async ({ id }) => {
        await delay();
        const report = store.reports.find((r) => r.id === id);
        if (!report) throw { response: { data: { error: "Report not found" }, status: 404 } };
        report.status = "resolved";
        report.updatedAt = now();
        return wrap({ id: report.id, status: report.status, responderId: report.responderId ?? "user_demo", responderCount: report.responderCount ?? 1 });
    },
    "DELETE /reports/:id": async ({ id }) => {
        await delay();
        const index = store.reports.findIndex((r) => r.id === id);
        if (index < 0) throw { response: { data: { error: "Report not found" }, status: 404 } };
        store.reports.splice(index, 1);
        return wrap({ success: true, id });
    },
    "GET /users/:id/reports": async ({ id }) => {
        await delay(300);
        return wrap(store.reports.filter((r) => r.userId === id));
    },
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
const alertsHandlers = {
    "GET /alerts": async () => {
        await delay(300);
        return wrap(store.alerts.filter((a) => a.active));
    },
    "GET /alerts/feed": async () => {
        await delay(300);
        return wrap(store.alerts);
    },
    "POST /alerts": async ({ data }) => {
        await delay();
        const alert = { id: genId(), ...data, active: true, createdAt: now() };
        store.alerts.push(alert);
        return wrap(alert);
    },
    "PATCH /alerts/:id": async ({ id, data }) => {
        await delay();
        const alert = store.alerts.find((a) => a.id === id);
        if (!alert) throw { response: { data: { error: "Alert not found" }, status: 404 } };
        Object.assign(alert, data);
        return wrap(alert);
    },
};

// ─── SOS ──────────────────────────────────────────────────────────────────────
const sosHandlers = {
    "POST /sos": async ({ data }) => {
        await delay();
        const sos = {
            id: genId(), userId: data.userId ?? "user_demo",
            type: data.type, location: data.location,
            urgency: data.urgency, description: data.description ?? "",
            imageUrl: data.imageUrl ?? null,
            status: "pending",
            statusHistory: [{ from: null, to: "pending", at: now(), by: data.userId ?? "user_demo" }],
            createdAt: now(), updatedAt: now(),
        };
        store.sosRequests.push(sos);
        return wrap(sos);
    },
    "GET /sos/:id": async ({ id }) => {
        await delay(200);
        const sos = store.sosRequests.find((s) => s.id === id);
        if (!sos) throw { response: { data: { error: "SOS not found" }, status: 404 } };
        return wrap(sos);
    },
    "PATCH /sos/:id/status": async ({ id, data }) => {
        await delay();
        const sos = store.sosRequests.find((s) => s.id === id);
        if (!sos) throw { response: { data: { error: "SOS not found" }, status: 404 } };
        const prev = sos.status;
        sos.status = data.status;
        sos.updatedAt = now();
        sos.statusHistory.push({ from: prev, to: data.status, at: now(), by: data.actorId ?? "system" });
        return wrap(sos);
    },
    "GET /users/:id/sos": async ({ id }) => {
        await delay(300);
        return wrap(store.sosRequests.filter((s) => s.userId === id));
    },
    "PATCH /sos/:id/resolve": async ({ id }) => {
        await delay();
        const sos = store.sosRequests.find((s) => s.id === id);
        if (!sos) throw { response: { data: { error: "SOS not found" }, status: 404 } };
        sos.status = "resolved";
        sos.updatedAt = now();
        return wrap(sos);
    },
};

// ─── History ──────────────────────────────────────────────────────────────────
const historyHandlers = {
    "GET /users/:id/history": async ({ id, params }) => {
        await delay(400);
        const { type, page = 1, limit = 20 } = params;
        let events = [];
        if (!type || type === "report") {
            store.reports.filter((r) => r.userId === id).forEach((r) =>
                events.push({ _type: "report", _timestamp: r.createdAt, ...r })
            );
        }
        if (!type || type === "sos") {
            store.sosRequests.filter((s) => s.userId === id).forEach((s) =>
                events.push({ _type: "sos", _timestamp: s.createdAt, ...s })
            );
        }
        if (!type || type === "point") {
            store.pointsLedger.filter((p) => p.userId === id).forEach((p) =>
                events.push({ _type: "point", _timestamp: p.timestamp, ...p })
            );
        }
        if (!type || type === "voucher") {
            store.vouchers.filter((v) => v.userId === id).forEach((v) =>
                events.push({ _type: "voucher", _timestamp: v.issuedAt, ...v })
            );
        }
        events.sort((a, b) => new Date(b._timestamp) - new Date(a._timestamp));
        const total = events.length;
        const items = events.slice((page - 1) * limit, page * limit);
        return wrap({
            items, page, pageSize: +limit, total,
            totalPages: Math.ceil(total / limit),
            summary: {
                totalReports: store.reports.filter((r) => r.userId === id).length,
                totalSos: store.sosRequests.filter((s) => s.userId === id).length,
                pointBalance: store.pointsLedger.filter((p) => p.userId === id).reduce((s, p) => s + p.points, 0),
                activeVouchers: store.vouchers.filter((v) => v.userId === id && !v.redeemed).length,
            },
        });
    },
};

// ─── Points ───────────────────────────────────────────────────────────────────
const pointsHandlers = {
    "GET /users/:id/points": async ({ id }) => {
        await delay(200);
        const earned = store.pointsLedger.filter((p) => p.userId === id).reduce((s, p) => s + p.points, 0);
        return wrap({ userId: id, earned, redeemed: 0, balance: earned });
    },
    "GET /users/:id/points/ledger": async ({ id }) => {
        await delay(300);
        return wrap(store.pointsLedger.filter((p) => p.userId === id));
    },
};

// ─── Vouchers ─────────────────────────────────────────────────────────────────
const vouchersHandlers = {
    "GET /users/:id/vouchers": async ({ id }) => {
        await delay(300);
        return wrap(store.vouchers.filter((v) => v.userId === id));
    },
    "POST /vouchers/:id/redeem": async ({ id }) => {
        await delay();
        const v = store.vouchers.find((v) => v.id === id || v.code === id);
        if (!v) throw { response: { data: { error: "Voucher not found" }, status: 404 } };
        if (v.redeemed) throw { response: { data: { error: "Already redeemed" }, status: 400 } };
        v.redeemed = true;
        v.redeemedAt = now();
        return wrap(v);
    },
};

// ─── User Settings ─────────────────────────────────────────────────────────────
const _settingsStore = {};
const settingsHandlers = {
    "GET /users/:id/settings": async ({ id }) => {
        await delay(200);
        return wrap(_settingsStore[id] ?? { anonymousReports: false, notifications: true, shareLocation: true, reportStatusUpdates: true, communityUpdates: false });
    },
    "PATCH /users/:id/settings": async ({ id, data }) => {
        await delay(250);
        _settingsStore[id] = { ...(_settingsStore[id] ?? {}), ...data };
        return wrap(_settingsStore[id]);
    },
    "GET /user/settings": async () => {
        await delay(200);
        return wrap(_settingsStore[DEMO_USER.userId] ?? { anonymousReports: false, notifications: true, shareLocation: true, reportStatusUpdates: true, communityUpdates: false });
    },
    "PUT /user/settings": async ({ data }) => {
        await delay(250);
        _settingsStore[DEMO_USER.userId] = { ...(_settingsStore[DEMO_USER.userId] ?? {}), ...data };
        return wrap(_settingsStore[DEMO_USER.userId]);
    },
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
const authHandlers = {
    "POST /auth/register": async ({ data }) => {
        await delay();
        return wrap({ userId: data.userId, role: "user", name: data.displayName || data.userId, email: "", displayName: data.displayName || data.userId, token: "mock_token" });
    },
    "POST /auth/login": async ({ data }) => {
        await delay();
        return wrap({ userId: data.userId, role: "user", name: "Demo User", email: "demo@citysafe.app", displayName: "Demo User", token: "mock_token" });
    },
    "GET /auth/me": async () => {
        await delay(200);
        return wrap(DEMO_USER);
    },
    "GET /user/me": async () => {
        await delay(200);
        return wrap({ ...DEMO_USER, settings: _settingsStore[DEMO_USER.userId] ?? { anonymousReports: false, notifications: true, shareLocation: true, reportStatusUpdates: true, communityUpdates: false } });
    },
};

// ─── Community Feed ───────────────────────────────────────────────────────────
const communityHandlers = {
    "GET /community/feed": async () => {
        await delay(400);
        const ACTIVE_REPORT_STATUSES = ["submitted", "under_review", "verified", "rejected"];
        const activeReports = store.reports
            .filter((r) => ACTIVE_REPORT_STATUSES.includes(r.status))
            .map((r) => ({
                id: r.id,
                _type: "report",
                description: r.description,
                type: r.type,
                status: r.status,
                location: r.location,
                createdAt: r.createdAt,
                userId: r.userId,
                imageUrl: r.imageUrl ?? r.imageRef ?? null,
                responderId: r.responderId ?? null,
                responderCount: r.responderCount ?? 0,
            }));

        const activeSos = store.sosRequests
            .filter((s) => ["pending", "under_review"].includes(s.status))
            .map((s) => ({
                id: s.id,
                _type: "sos",
                description: s.description,
                type: s.type,
                urgency: s.urgency,
                status: s.responderCount ? "in_progress" : s.status,
                location: s.location,
                createdAt: s.createdAt,
                userId: s.userId,
                imageUrl: s.imageUrl ?? null,
                responderId: s.responderId ?? null,
                responderCount: s.responderCount ?? 0,
            }));

        const feed = [...activeSos, ...activeReports]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return wrap(feed);
    },
    "POST /community/respond": async ({ data }) => {
        await delay(250);
        const collection = data.type === "sos" ? store.sosRequests : store.reports;
        const item = collection.find((entry) => entry.id === data.requestId);

        if (!item) {
            throw new Error("Request not found.");
        }

        item.responderId = "user_demo";
        item.responderCount = (item.responderCount ?? 0) + 1;

        if (data.type === "sos" && item.status === "pending") {
            item.status = "under_review";
        }

        return wrap({
            success: true,
            message: "You are now responding to this request",
            data: {
                requestId: item.id,
                type: data.type,
                responderId: item.responderId,
                responderCount: item.responderCount,
                status: "in_progress",
            },
        });
    },
    "POST /ratings": async ({ data }) => {
        await delay(250);
        return wrap({ id: genId(), reportId: data.reportId, userId: "user_demo", rating: data.rating, createdAt: now() });
    },
};

const uploadHandlers = {
    "POST /upload": async () => {
        await delay(200);
        return wrap({ imageUrl: "https://placehold.co/600x400/png" });
    },
};

const allHandlers = {
    ...authHandlers,
    ...reportsHandlers, ...alertsHandlers, ...sosHandlers,
    ...historyHandlers, ...pointsHandlers, ...vouchersHandlers,
    ...settingsHandlers, ...communityHandlers, ...uploadHandlers,
};

// ─── Router ───────────────────────────────────────────────────────────────────
const routeMatch = (pattern, path) => {
    const pParts = pattern.split("/");
    const uParts = path.split("/");
    if (pParts.length !== uParts.length) return null;
    const params = {};
    for (let i = 0; i < pParts.length; i++) {
        if (pParts[i].startsWith(":")) {
            params[pParts[i].slice(1)] = uParts[i];
        } else if (pParts[i] !== uParts[i]) {
            return null;
        }
    }
    return params;
};

export const mockRequest = async (method, url, data, params = {}) => {
    const path = url.replace(/^\//, "");
    for (const [key, handler] of Object.entries(allHandlers)) {
        const [m, pattern] = key.split(" ");
        if (m !== method.toUpperCase()) continue;
        const routeParams = routeMatch(pattern.replace(/^\//, ""), path);
        if (routeParams !== null) {
            return await handler({ ...routeParams, data, params });
        }
    }
    throw { response: { data: { error: `No mock handler for ${method} /${path}` }, status: 404 } };
};

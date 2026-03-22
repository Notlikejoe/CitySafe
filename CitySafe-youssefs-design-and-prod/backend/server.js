/**
 * CitySafe Express API Server
 * - REST API on port 4000
 * - JWT authentication
 * - Rate limiting
 * - WebSocket (Socket.io) for real-time SOS broadcasts
 * - Multer for image uploads
 * - Global error handling
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io"; // Changed from SocketIO
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs"; // Added
import he from "he"; // Added
import cookieParser from "cookie-parser";
import { query } from "./db.js"; // Added

dotenv.config();

// ─── Domain imports ─────────────────────────────────────────────────────────
import { createReport, transitionReportStatus, getNearbyReports, getReportsByUser, adminVerifyReport, adminRejectReport, cancelReport } from "./features/reports.js";
import { createAlert, getActiveAlerts } from "./features/alerts.js";
import { createSosRequest, updateSosStatus, getActiveSosRequests, getSosRequestsByUser } from "./features/sos.js";
import { awardPoints, getPointsLeaderboard, getUserLedger } from "./features/points.js";
import { getVouchers, redeemVoucher } from "./features/vouchers.js";
import { getUserHistory } from "./features/history.js";
import { getCrowdZones } from "./features/crowd.js";
import { searchContent } from "./features/search.js";
import { query } from "./db.js";
import { log } from "./utils.js";

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) throw new Error("CRITICAL: JWT_SECRET environment variable is missing.");
const JWT_SECRET = process.env.JWT_SECRET;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { // Changed from SocketIO
    cors: { origin: "*", credentials: true } // Added credentials
});

// Attach io to app so controllers can emit
app.set("io", io);

// ─── Multer (image uploads) ───────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "uploads");
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB cap

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cookieParser()); // Added
const ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8888",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8888",
];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl) or matching origins
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true
}));

// Security headers via helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
        },
    },
}));
app.use(express.json({ limit: "2mb" })); // Kept limit
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));

// Structured request logging
app.use((req, _res, next) => {
    log("info", "http.request", { method: req.method, url: req.url, ip: req.ip });
    next();
});

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 100, // 100 requests per 15 min per IP (human-usage threshold)
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later." },
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 login attempts per 15 min per IP
    message: { success: false, error: "Too many login attempts, please try again later." },
});
const sosLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10, // 10 SOS requests per 10 min per IP
    message: { success: false, error: "Too many SOS requests from this IP." },
});
app.use(globalLimiter);

// ─── Auth Middleware ──────────────────────────────────────────────────────────

/** Verifies JWT and attaches req.user = { userId, role } */
const requireAuth = (req, res, next) => {
    const token = req.cookies?.cs_token; // Read token from cookie
    if (!token) {
        return res.status(401).json({ success: false, error: "Missing or invalid token cookie." });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload; // { userId, role }
        next();
    } catch {
        return res.status(401).json({ success: false, error: "Invalid or expired token." });
    }
};

/**
 * Checks that the authenticated user is either:
 * (a) the resource owner (userId matches), OR
 * (b) has role "admin"
 */
const requireOwnerOrAdmin = (ownerIdFn) => (req, res, next) => {
    const ownerId = ownerIdFn(req);
    if (req.user.userId !== ownerId && req.user.role !== "admin") {
        return res.status(403).json({ success: false, error: "Forbidden." });
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, error: "Admin access required." });
    }
    next();
};

// ─── User seeding (moved to store initialization below) ────────────

// ─── Helpers ─────────────────────────────────────────────────────────────────
const send = (res, result, statusOnError = 400) => {
    if (result.success) return res.json(result.data);
    return res.status(statusOnError).json({ error: result.error });
};

const created = (res, result) => {
    if (result.success) return res.status(201).json(result.data);
    return res.status(400).json({ error: result.error });
};

// Helper for consistent success responses
const ok = (res, data) => res.json({ success: true, data });
// Helper for consistent error responses
const unauthorized = (res, message = "Unauthorized") => res.status(401).json({ success: false, error: message });


// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { userId, password, displayName } = req.body;
    if (!userId || !password) return res.status(400).json({ error: "Missing credentials" });
    if (userId.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

    const existing = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
    if (existing.success && existing.data?.rows?.length > 0) {
        return res.status(400).json({ error: "Username already exists." });
    }

    const hash = await bcrypt.hash(password, 10);
    const insertRes = await query(
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'member') RETURNING id, role`,
        [userId, hash]
    );

    if (!insertRes.success) return res.status(500).json({ error: "Registration failed." });

    const newUid = insertRes.data.rows[0].id;
    const role = insertRes.data.rows[0].role;

    // Award sign up points using the Postgres function
    await query(`SELECT award_points($1, $2, $3)`, [newUid, 50, "Welcome to CitySafe"]);

    const token = jwt.sign({ userId: newUid, role }, JWT_SECRET, { expiresIn: "24h" });
    log("info", "auth.register", { userId });

    res.cookie('cs_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });
    return res.status(201).json({ userId: newUid, role, displayName: displayName ?? userId });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { userId, password } = req.body;
    if (!userId || !password) return res.status(400).json({ error: "Missing credentials" });

    const searchRes = await query(`SELECT id, username, password_hash, role FROM users WHERE username = $1`, [userId]);
    if (!searchRes.success || searchRes.data?.rows?.length === 0) {
        await bcrypt.compare(password, "$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
        return res.status(401).json({ error: "Invalid credentials." });
    }

    const user = searchRes.data.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials." });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    log("info", "auth.login", { userId, role: user.role });

    res.cookie('cs_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });
    return res.json({ userId: user.id, role: user.role, displayName: user.username });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
    const userRes = await query(`SELECT username FROM users WHERE id = $1`, [req.user.userId]);
    if (!userRes.success || userRes.data?.rows?.length === 0) {
        return res.status(404).json({ error: "User not found." });
    }
    const displayName = userRes.data.rows[0].username;
    return res.json({ userId: req.user.userId, role: req.user.role, displayName });
});

app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('cs_token');
    return res.json({ success: true, message: "Logged out" });
});

// ─── Reports Routes ───────────────────────────────────────────────────────────
app.get("/api/reports", requireAuth, async (req, res) => {
    const { lat, lon, radius = 5, page = 1 } = req.query;
    if (lat && lon) {
        const result = await getNearbyReports(parseFloat(lat), parseFloat(lon), parseFloat(radius), parseInt(page));
        return send(res, result);
    }
    return res.json([]);
});

app.post("/api/reports", requireAuth, upload.single("image"), (req, res) => {
    const body = req.body;
    const imageRef = req.file ? `/uploads/${req.file.filename}` : (body.imageRef ?? null);
    const result = createReport({
        userId: req.user.userId,
        location: body.location ? (typeof body.location === "string" ? JSON.parse(body.location) : body.location) : null,
        type: body.type,
        description: body.description,
        imageRef,
    });
    const io = req.app.get("io");
    if (result.success) io.emit("report:new", result.data);
    return created(res, result);
});

app.get("/api/reports/:id", requireAuth, async (req, res) => {
    const q = await query(`SELECT * FROM reports WHERE id = $1`, [req.params.id]);
    if (!q.success || q.data.rows.length === 0) return res.status(404).json({ error: "Report not found." });
    return res.json(q.data.rows[0]);
});

app.patch("/api/reports/:id/status", requireAuth, requireAdmin, (req, res) => {
    const { status, expectedVersion } = req.body;
    const result = transitionReportStatus(req.params.id, status, req.user.userId, expectedVersion ?? null);
    return send(res, result);
});

app.post("/api/reports/:id/verify", requireAuth, requireAdmin, (req, res) => {
    const result = adminVerifyReport(req.params.id, req.user.userId);
    if (result.success) req.app.get("io").emit("report:verified", result.data);
    return send(res, result);
});

app.post("/api/reports/:id/reject", requireAuth, requireAdmin, (req, res) => {
    const result = adminRejectReport(req.params.id, req.user.userId);
    return send(res, result);
});

app.delete("/api/reports/:id/cancel", requireAuth, (req, res) => {
    const result = cancelReport(req.params.id, req.user.userId);
    return send(res, result);
});

app.get("/api/users/:id/reports", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    const result = getReportsByUser(req.params.id, req.query.status ?? null);
    return send(res, result);
});

// ─── Alerts Routes ────────────────────────────────────────────────────────────
app.get("/api/alerts", requireAuth, async (req, res) => {
    const { lat, lon, radius = 5 } = req.query;
    if (lat && lon) {
        const result = await getActiveAlerts(parseFloat(lat), parseFloat(lon), parseFloat(radius));
        return send(res, result);
    }
    return res.json([]);
});

app.get("/api/alerts/feed", requireAuth, async (req, res) => {
    // For feed, just return active alerts in a large radius
    const result = await getActiveAlerts(0, 0, 100000);
    return send(res, result);
});

app.post("/api/alerts", requireAuth, requireAdmin, async (req, res) => {
    const result = await createAlert(req.user.userId, req.body);
    if (result.success) req.app.get("io").emit("alert:new", result.data);
    return created(res, result);
});

app.patch("/api/alerts/:id", requireAuth, requireAdmin, async (req, res) => {
    const queryRes = await query(`UPDATE alerts SET active = false WHERE id = $1 RETURNING *`, [req.params.id]);
    if (queryRes.success && queryRes.data.rows.length > 0) {
        req.app.get("io").emit("alert:deactivated", queryRes.data.rows[0]);
        return res.json(queryRes.data.rows[0]);
    }
    return res.status(404).json({ error: "Alert not found" });
});

// ─── SOS Routes ───────────────────────────────────────────────────────────────
app.post("/api/sos", requireAuth, sosLimiter, async (req, res) => {
    const result = await createSosRequest(req.user.userId, req.body);
    if (result.success) req.app.get("io").emit("sos:new", result.data);
    return created(res, result);
});

app.get("/api/sos/:id", requireAuth, async (req, res) => {
    const q = await query(`SELECT * FROM sos_requests WHERE id = $1`, [req.params.id]);
    if (!q.success || q.data.rows.length === 0) return res.status(404).json({ error: "SOS not found." });

    const sos = q.data.rows[0];
    if (req.user.role !== "admin" && sos.requester_id !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden." });
    }
    return res.json(sos);
});

app.patch("/api/sos/:id/status", requireAuth, async (req, res) => {
    const q = await query(`SELECT * FROM sos_requests WHERE id = $1`, [req.params.id]);
    if (!q.success || q.data.rows.length === 0) return res.status(404).json({ error: "SOS not found." });

    const sos = q.data.rows[0];
    const isCancelling = req.body.status === "cancelled";
    if (!isCancelling && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can progress SOS status." });
    }
    if (isCancelling && sos.requester_id !== req.user.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden." });
    }
    const result = await updateSosStatus(req.params.id, req.body.status);
    if (result.success) req.app.get("io").emit("sos:updated", result.data);
    return send(res, result);
});

app.get("/api/users/:id/sos", requireAuth, requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
    const result = await getSosRequestsByUser(req.params.id, parseInt(req.query.page || "1"));
    return send(res, result);
});

// ─── Points Routes ────────────────────────────────────────────────────────────
app.get("/api/users/:id/points", requireAuth, requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
    const result = await getUserLedger(req.params.id);
    if (result.success) {
        return res.json({ balance: result.data.totalPoints });
    }
    return send(res, result);
});

app.get("/api/users/:id/points/ledger", requireAuth, requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
    const result = await getUserLedger(req.params.id);
    return send(res, result);
});

app.post("/api/users/:id/points", requireAuth, requireAdmin, async (req, res) => {
    const result = await awardPoints({
        userId: req.params.id,
        reason: req.body.reason
    });
    return send(res, result);
});

// ─── Vouchers Routes ──────────────────────────────────────────────────────────
app.get("/api/users/:id/vouchers", requireAuth, requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
    const vRes = await query(`
        SELECT uv.id, v.code, v.sponsor, uv.redeemed_at 
        FROM user_vouchers uv JOIN vouchers v ON uv.voucher_id = v.id 
        WHERE uv.user_id = $1
    `, [req.params.id]);
    return res.json(vRes.success ? vRes.data.rows : []);
});

app.post("/api/vouchers/:id/redeem", requireAuth, async (req, res) => {
    const result = await redeemVoucher(req.user.userId, req.params.id);
    return send(res, result);
});

// ─── History Routes ───────────────────────────────────────────────────────────
app.get("/api/users/:id/history", requireAuth, requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
    const result = await getUserHistory(req.params.id, {
        type: req.query.type ?? null,
        page: req.query.page ? parseInt(req.query.page) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize) : (req.query.limit ? parseInt(req.query.limit) : 20),
    });
    return send(res, result);
});

// ─── User Settings ────────────────────────────────────────────────────────────
app.get("/api/users/:id/settings", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    return res.json({ anonymousReports: false, notifications: true });
});

app.patch("/api/users/:id/settings", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    const updated = { anonymousReports: false, notifications: true, ...req.body };
    log("info", "user.settings_updated", { userId: req.params.id, settings: updated });
    return res.json(updated);
});

// ─── Search Route ─────────────────────────────────────────────────────────────
app.get("/api/search", requireAuth, (req, res) => {
    const { q, lat, lon, radius, type, page } = req.query;
    const opts = {
        lat: lat ? parseFloat(lat) : undefined,
        lon: lon ? parseFloat(lon) : undefined,
        radius: radius ? parseFloat(radius) : 10,
        type: type || undefined,
        page: page ? parseInt(page, 10) : 1,
    };
    const result = searchContent(q, opts);
    return send(res, result);
});

// ─── Crowd Density Route ──────────────────────────────────────────────────────
app.get("/api/crowd-density", requireAuth, async (req, res) => {
    const result = await getCrowdZones();
    return send(res, result);
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
    log("error", "unhandled_express_error", { message: err.message, stack: err.stack, url: req.url });
    res.status(500).json({ error: "Internal server error." });
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.use((socket, next) => {
    // Optional JWT auth for sockets (clients can pass token as query param)
    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
    if (token) {
        try {
            socket.user = jwt.verify(token, JWT_SECRET);
        } catch { /* anonymous socket still connects */ }
    }
    next();
});

io.on("connection", (socket) => {
    log("info", "ws.connected", { socketId: socket.id, userId: socket.user?.userId ?? "anon" });
    socket.on("disconnect", () => {
        log("info", "ws.disconnected", { socketId: socket.id });
    });
});

// ─── Start ────────────────────────────────────────────────────────────────────
// Note: alert expiry is handled in PostgreSQL via expires_at column.
// Seed users are provisioned directly via the database (init.sql).

httpServer.listen(PORT, () => {
    log("info", "server.started", { port: PORT, mode: process.env.NODE_ENV ?? "development" });
    console.log(`\n🚀  CitySafe API running → http://localhost:${PORT}\n`);
});

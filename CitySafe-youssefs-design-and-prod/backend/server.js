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
import { createServer } from "http";
import { Server as SocketIO } from "socket.io";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// ─── Domain imports ─────────────────────────────────────────────────────────
import { createReport, transitionReportStatus, getNearbyReports, getReportsByUser, adminVerifyReport, adminRejectReport, cancelReport } from "./features/reports.js";
import { createAlert, getNearbyAlerts, getAlertsFeed, deactivateAlert, expireAlerts } from "./features/alerts.js";
import { createSos, transitionSosStatus, getUserSosHistory } from "./features/sos.js";
import { getUserBalance, getUserPointsLedger, awardPoints } from "./features/points.js";
import { redeemVoucher, getUserVouchers } from "./features/vouchers.js";
import { getUserHistory } from "./features/history.js";
import { store, loadStore, schedulePersist } from "./store.js";
import { log } from "./utils.js";

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
if (!process.env.JWT_SECRET) throw new Error("CRITICAL: JWT_SECRET environment variable is missing.");
const JWT_SECRET = process.env.JWT_SECRET;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST", "PATCH", "DELETE"] }
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
app.use(cors());

// Content Security Policy
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; form-action 'self'; frame-ancestors 'none';");
    next();
});
app.use(express.json({ limit: "2mb" }));
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
    max: 5000, // Greatly increased for dev stability
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Too many requests, please try again later." },
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Greatly increased for dev auto-logins
    message: { success: false, error: "Too many login attempts, please try again later." },
});
const sosLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 500,
    message: { success: false, error: "Too many SOS requests from this IP." },
});
app.use(globalLimiter);

// ─── Auth Middleware ──────────────────────────────────────────────────────────

/** Verifies JWT and attaches req.user = { userId, role } */
const requireAuth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Authorization header missing or malformed." });
    }
    const token = header.slice(7);
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

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { userId, password, displayName } = req.body;
    if (!userId || !password) return res.status(400).json({ error: "userId and password required." });
    if (store.users[userId]) return res.status(409).json({ error: "User already exists." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return res.status(400).json({ error: "Password must contain at least one letter and one number." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    store.users[userId] = { passwordHash, role: "user", displayName: displayName ?? userId };
    schedulePersist();

    const token = jwt.sign({ userId, role: "user" }, JWT_SECRET, { expiresIn: "24h" });
    log("info", "auth.register", { userId });
    return res.status(201).json({ userId, role: "user", displayName: displayName ?? userId, token });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { userId, password } = req.body;
    if (!userId || !password) return res.status(400).json({ error: "userId and password required." });

    const user = store.users[userId];
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials." });

    const token = jwt.sign({ userId, role: user.role }, JWT_SECRET, { expiresIn: "24h" });
    log("info", "auth.login", { userId, role: user.role });
    return res.json({ userId, role: user.role, displayName: user.displayName, token });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
    const user = store.users[req.user.userId];
    if (!user) return res.status(404).json({ error: "User not found." });
    return res.json({ userId: req.user.userId, role: req.user.role, displayName: user.displayName });
});

// ─── Reports Routes ───────────────────────────────────────────────────────────
app.get("/api/reports", requireAuth, (req, res) => {
    const { lat, lon, radius = 5, type, status, page, pageSize } = req.query;
    if (lat && lon) {
        const result = getNearbyReports(
            { lat: parseFloat(lat), lon: parseFloat(lon) },
            parseFloat(radius),
            {
                type, status,
                page: page ? parseInt(page) : 1,
                pageSize: pageSize ? parseInt(pageSize) : 50,
            }
        );
        return send(res, result);
    }
    // Fallback: return all if no location given
    return res.json(store.reports);
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

app.get("/api/reports/:id", requireAuth, (req, res) => {
    const report = store.reports.find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found." });
    return res.json(report);
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
app.get("/api/alerts", requireAuth, (req, res) => {
    const { lat, lon, radius = 5 } = req.query;
    if (lat && lon) {
        const result = getNearbyAlerts(
            { lat: parseFloat(lat), lon: parseFloat(lon) },
            parseFloat(radius)
        );
        return send(res, result);
    }
    const result = getAlertsFeed();
    return send(res, result);
});

app.get("/api/alerts/feed", requireAuth, (req, res) => {
    const result = getAlertsFeed({ includeExpired: req.query.includeExpired === "true" });
    return send(res, result);
});

app.post("/api/alerts", requireAuth, requireAdmin, (req, res) => {
    const result = createAlert({ ...req.body, createdBy: req.user.userId });
    if (result.success) req.app.get("io").emit("alert:new", result.data);
    return created(res, result);
});

app.patch("/api/alerts/:id", requireAuth, requireAdmin, (req, res) => {
    const result = deactivateAlert(req.params.id, req.user.userId);
    if (result.success) req.app.get("io").emit("alert:deactivated", result.data);
    return send(res, result);
});

// ─── SOS Routes ───────────────────────────────────────────────────────────────
app.post("/api/sos", requireAuth, sosLimiter, (req, res) => {
    const result = createSos({
        userId: req.user.userId,
        type: req.body.type,
        location: req.body.location,
        urgency: req.body.urgency,
        description: req.body.description,
    });
    if (result.success) req.app.get("io").emit("sos:new", result.data);
    return created(res, result);
});

app.get("/api/sos/:id", requireAuth, (req, res) => {
    const sos = store.sosRequests.find((s) => s.id === req.params.id);
    if (!sos) return res.status(404).json({ error: "SOS not found." });
    if (req.user.role !== "admin" && sos.userId !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden." });
    }
    return res.json(sos);
});

app.patch("/api/sos/:id/status", requireAuth, (req, res) => {
    const sos = store.sosRequests.find((s) => s.id === req.params.id);
    if (!sos) return res.status(404).json({ error: "SOS not found." });
    // Cancel: owner or admin. Accept/progress/resolve: admin only.
    const isCancelling = req.body.status === "cancelled";
    if (!isCancelling && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only admins can progress SOS status." });
    }
    if (isCancelling && sos.userId !== req.user.userId && req.user.role !== "admin") {
        return res.status(403).json({ error: "Forbidden." });
    }
    const result = transitionSosStatus(req.params.id, req.body.status, req.user.userId, req.body.expectedVersion ?? null);
    if (result.success) req.app.get("io").emit("sos:updated", result.data);
    return send(res, result);
});

app.get("/api/users/:id/sos", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    const result = getUserSosHistory(req.params.id, req.query.status ?? null);
    return send(res, result);
});

// ─── Points Routes ────────────────────────────────────────────────────────────
app.get("/api/users/:id/points", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    const result = getUserBalance(req.params.id);
    return send(res, result);
});

app.get("/api/users/:id/points/ledger", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    const result = getUserPointsLedger(req.params.id);
    return send(res, result);
});

app.post("/api/users/:id/points", requireAuth, requireAdmin, (req, res) => {
    const result = awardPoints({
        userId: req.params.id,
        reason: req.body.reason,
        referenceId: req.body.referenceId,
        overrideAmount: req.body.overrideAmount ?? null,
    });
    return send(res, result);
});

// ─── Vouchers Routes ──────────────────────────────────────────────────────────
app.get("/api/users/:id/vouchers", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    const result = getUserVouchers(req.params.id, { activeOnly: req.query.activeOnly === "true" });
    return send(res, result);
});

app.post("/api/vouchers/:id/redeem", requireAuth, (req, res) => {
    const result = redeemVoucher(req.params.id, req.user.userId);
    return send(res, result);
});

// ─── History Routes ───────────────────────────────────────────────────────────
app.get("/api/users/:id/history", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    const result = getUserHistory(req.params.id, {
        type: req.query.type ?? null,
        page: req.query.page ? parseInt(req.query.page) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize) : (req.query.limit ? parseInt(req.query.limit) : 20),
    });
    return send(res, result);
});

// ─── User Settings ────────────────────────────────────────────────────────────
app.get("/api/users/:id/settings", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    const settings = store.userSettings[req.params.id] ?? { anonymousReports: false, notifications: true };
    return res.json(settings);
});

app.patch("/api/users/:id/settings", requireAuth, requireOwnerOrAdmin((req) => req.params.id), (req, res) => {
    const current = store.userSettings[req.params.id] ?? { anonymousReports: false, notifications: true };
    const updated = { ...current, ...req.body };
    store.userSettings[req.params.id] = updated;
    schedulePersist();
    log("info", "user.settings_updated", { userId: req.params.id, settings: updated });
    return res.json(updated);
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

// ─── Periodic alert cleanup ───────────────────────────────────────────────────
setInterval(() => expireAlerts(), 5 * 60 * 1000); // every 5 min

// ─── Start ────────────────────────────────────────────────────────────────────
loadStore();

// Seed default users if store is empty
if (Object.keys(store.users).length === 0) {
    store.users["user_demo"] = {
        passwordHash: bcrypt.hashSync("demo1234", 10),
        role: "user",
        displayName: "Demo User",
    };
    store.users["admin_01"] = {
        passwordHash: bcrypt.hashSync("admin1234", 10),
        role: "admin",
        displayName: "Admin",
    };
    schedulePersist();
}

httpServer.listen(PORT, () => {
    log("info", "server.started", { port: PORT, mode: process.env.NODE_ENV ?? "development" });
    console.log(`\n🚀  CitySafe API running → http://localhost:${PORT}\n`);
});

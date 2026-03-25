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
import { getAccessibilityResources } from "./features/accessibility.js";
import { searchContent } from "./features/search.js";
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
const ALLOWED_UPLOAD_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        // Restrict uploads to common image types used by the prototype UI.
        if (!ALLOWED_UPLOAD_TYPES.has(file.mimetype)) {
            const error = new Error("Only PNG, JPEG, and WEBP images are allowed.");
            error.status = 400;
            return cb(error);
        }
        cb(null, true);
    },
}); // 5 MB cap

// Fix 4: Ensure uploads directory exists at startup (prevents multer crash on fresh clone)
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    log("info", "uploads.dir.created", { path: uploadDir });
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cookieParser()); // Added
const ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:8888",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
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
    // Allow uploaded images to be embedded by the frontend running on a
    // different localhost origin (for example 5173 -> 4001).
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(express.json({ limit: "2mb" })); // Kept limit
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir, {
    setHeaders: (res) => {
        // Static uploads are rendered directly in <img> tags from the frontend.
        // These headers prevent the browser from blocking the resource when the
        // API and frontend run on different local origins.
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Access-Control-Allow-Origin", "*");
    },
}));

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

const communityResponders = new Map();

const getCommunityResponderState = (requestId) => {
    const state = communityResponders.get(requestId);
    if (!state) {
        return { responderId: null, responderCount: 0 };
    }

    const responderIds = Array.from(state.responderIds);
    return {
        responderId: responderIds[0] ?? null,
        responderCount: responderIds.length,
    };
};

const normalizeCommunitySosStatus = (dbStatus, responderCount) => {
    if (responderCount > 0) return "in_progress";
    if (dbStatus === "under_review") return "active";
    return dbStatus;
};

const normalizeCommunityReportStatus = (dbStatus, responderCount) => {
    if (responderCount > 0) return "in_progress";
    return dbStatus;
};

const normalizeImageUrl = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();

    // Accept only actual file/URL values so description-like text never ends up
    // bound into image elements on the frontend.
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("/uploads/")) return trimmed;
    return null;
};

const DEFAULT_SETTINGS = {
    notifications: true,
    reportStatusUpdates: true,
    communityUpdates: false,
    shareLocation: true,
    anonymousReports: false,
};

const serializeSettings = (row = {}) => ({
    notifications: row.notifications ?? DEFAULT_SETTINGS.notifications,
    reportStatusUpdates: row.report_status_updates ?? DEFAULT_SETTINGS.reportStatusUpdates,
    communityUpdates: row.community_updates ?? DEFAULT_SETTINGS.communityUpdates,
    shareLocation: row.share_location ?? DEFAULT_SETTINGS.shareLocation,
    anonymousReports: row.anonymous_reports ?? DEFAULT_SETTINGS.anonymousReports,
});

const normalizeUserProfile = (row) => ({
    userId: row.id,
    username: row.username,
    name: row.name || row.username,
    email: row.email ?? "",
    role: row.role,
    displayName: row.name || row.username,
});

const ensureUserSettingsRow = async (userId) => {
    await query(`
        INSERT INTO user_settings (
            user_id,
            notifications,
            report_status_updates,
            community_updates,
            share_location,
            anonymous_reports
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO NOTHING
    `, [
        userId,
        DEFAULT_SETTINGS.notifications,
        DEFAULT_SETTINGS.reportStatusUpdates,
        DEFAULT_SETTINGS.communityUpdates,
        DEFAULT_SETTINGS.shareLocation,
        DEFAULT_SETTINGS.anonymousReports,
    ]);
};

const getUserProfileWithSettings = async (userId) => {
    await ensureUserSettingsRow(userId);

    return query(`
        SELECT
            u.id,
            u.username,
            COALESCE(NULLIF(u.name, ''), u.username) AS name,
            COALESCE(u.email, '') AS email,
            u.role,
            us.notifications,
            us.report_status_updates,
            us.community_updates,
            us.share_location,
            us.anonymous_reports
        FROM users u
        LEFT JOIN user_settings us ON us.user_id = u.id
        WHERE u.id = $1
    `, [userId]);
};

const loadCurrentUserOr404 = async (req, res) => {
    const userRes = await getUserProfileWithSettings(req.user.userId);
    if (!userRes.success) {
        res.status(500).json({ error: `Failed to load user profile: ${userRes.error}` });
        return null;
    }

    const row = userRes.data.rows[0];
    if (!row) {
        res.status(404).json({ error: "User not found." });
        return null;
    }

    return row;
};

const upsertUserSettings = async (userId, body = {}) => {
    await ensureUserSettingsRow(userId);
    const currentSettingsRes = await query(`
        SELECT notifications, report_status_updates, community_updates, share_location, anonymous_reports
        FROM user_settings
        WHERE user_id = $1
    `, [userId]);

    const currentSettings = serializeSettings(currentSettingsRes.success ? currentSettingsRes.data.rows[0] : undefined);
    const nextSettings = {
        notifications: body.notifications ?? currentSettings.notifications,
        reportStatusUpdates: body.reportStatusUpdates ?? currentSettings.reportStatusUpdates,
        communityUpdates: body.communityUpdates ?? currentSettings.communityUpdates,
        shareLocation: body.shareLocation ?? currentSettings.shareLocation,
        anonymousReports: body.anonymousReports ?? currentSettings.anonymousReports,
    };

    const updateRes = await query(`
        INSERT INTO user_settings (
            user_id,
            notifications,
            report_status_updates,
            community_updates,
            share_location,
            anonymous_reports,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            notifications = EXCLUDED.notifications,
            report_status_updates = EXCLUDED.report_status_updates,
            community_updates = EXCLUDED.community_updates,
            share_location = EXCLUDED.share_location,
            anonymous_reports = EXCLUDED.anonymous_reports,
            updated_at = NOW()
        RETURNING notifications, report_status_updates, community_updates, share_location, anonymous_reports
    `, [
        userId,
        !!nextSettings.notifications,
        !!nextSettings.reportStatusUpdates,
        !!nextSettings.communityUpdates,
        !!nextSettings.shareLocation,
        !!nextSettings.anonymousReports,
    ]);

    return {
        nextSettings,
        updateRes,
    };
};

const ensureRuntimeSchema = async () => {
    const statements = [
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
        `ALTER TABLE reports ADD COLUMN IF NOT EXISTS image_url TEXT`,
        `ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS image_url TEXT`,
        `CREATE TABLE IF NOT EXISTS user_settings (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            notifications BOOLEAN DEFAULT true,
            report_status_updates BOOLEAN DEFAULT true,
            community_updates BOOLEAN DEFAULT false,
            share_location BOOLEAN DEFAULT true,
            anonymous_reports BOOLEAN DEFAULT false,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS ratings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE (report_id, user_id)
        )`,
        `CREATE INDEX IF NOT EXISTS ratings_report_id_idx ON ratings (report_id)`,
        `UPDATE users SET name = COALESCE(NULLIF(name, ''), username) WHERE name IS NULL OR name = ''`,
        `UPDATE reports SET image_url = image_ref WHERE image_url IS NULL AND image_ref IS NOT NULL`,
    ];

    for (const sql of statements) {
        const result = await query(sql);
        if (!result.success) {
            throw new Error(result.error);
        }
    }
};


// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { userId, password, displayName, email = null } = req.body;
    if (!userId || !password) return res.status(400).json({ error: "Missing credentials" });
    if (userId.length < 3) return res.status(400).json({ error: "Username must be at least 3 characters." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        // Keep backend validation aligned with the signup guidance shown in the UI.
        return res.status(400).json({ error: "Password must contain at least one letter and one number." });
    }

    const existing = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
    if (existing.success && existing.data?.rows?.length > 0) {
        return res.status(400).json({ error: "Username already exists." });
    }

    const hash = await bcrypt.hash(password, 10);
    const insertRes = await query(
        `INSERT INTO users (username, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'member')
         RETURNING id, username, name, email, role`,
        [userId, displayName ?? userId, email, hash]
    );

    if (!insertRes.success) return res.status(500).json({ error: "Registration failed." });

    const insertedUser = insertRes.data.rows[0];
    const newUid = insertedUser.id;
    const role = insertedUser.role;

    // Award sign up points using the Postgres function
    await query(`SELECT award_points($1, $2, $3)`, [newUid, 50, "Welcome to CitySafe"]);
    await ensureUserSettingsRow(newUid);

    const token = jwt.sign({ userId: newUid, role }, JWT_SECRET, { expiresIn: "24h" });
    log("info", "auth.register", { userId });

    res.cookie('cs_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });
    return res.status(201).json({
        userId: newUid,
        role,
        name: insertedUser.name || insertedUser.username,
        email: insertedUser.email ?? "",
        displayName: insertedUser.name || insertedUser.username,
    });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { userId, password } = req.body;
    if (!userId || !password) return res.status(400).json({ error: "Missing credentials" });

    const searchRes = await query(
        `SELECT id, username, name, email, password_hash, role FROM users WHERE username = $1`,
        [userId]
    );
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
    await ensureUserSettingsRow(user.id);
    return res.json({
        userId: user.id,
        role: user.role,
        name: user.name || user.username,
        email: user.email ?? "",
        displayName: user.name || user.username,
    });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
    const row = await loadCurrentUserOr404(req, res);
    if (!row) return;
    return res.json({
        ...normalizeUserProfile(row),
        settings: serializeSettings(row),
    });
});

app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('cs_token');
    return res.json({ success: true, message: "Logged out" });
});

app.get("/api/user/me", requireAuth, async (req, res) => {
    const row = await loadCurrentUserOr404(req, res);
    if (!row) return;

    return res.json({
        ...normalizeUserProfile(row),
        settings: serializeSettings(row),
    });
});

app.get("/api/user/settings", requireAuth, async (req, res) => {
    const row = await loadCurrentUserOr404(req, res);
    if (!row) return;
    return res.json(serializeSettings(row));
});

app.put("/api/user/settings", requireAuth, async (req, res) => {
    const { nextSettings, updateRes } = await upsertUserSettings(req.user.userId, req.body);

    if (!updateRes.success) {
        return res.status(500).json({ error: `Failed to update settings: ${updateRes.error}` });
    }

    log("info", "user.settings_updated", { userId: req.user.userId, settings: nextSettings });
    return res.json(serializeSettings(updateRes.data.rows[0]));
});

app.post("/api/upload", requireAuth, upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "An image file is required." });
    }

    // Return a relative upload path; the frontend expands this against the
    // backend origin before rendering.
    return res.status(201).json({
        imageUrl: `/uploads/${req.file.filename}`,
    });
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

app.post("/api/reports", requireAuth, upload.single("image"), async (req, res) => {
    const body = req.body;
    const imageUrl = normalizeImageUrl(req.file ? `/uploads/${req.file.filename}` : (body.imageUrl ?? body.imageRef ?? null));
    const result = await createReport(req.user.userId, {
        location: body.location ? (typeof body.location === "string" ? JSON.parse(body.location) : body.location) : null,
        type: body.type,
        description: body.description,
        imageRef: imageUrl,
        imageUrl,
    });
    const io = req.app.get("io");
    if (result.success) io.emit("report:new", result.data);
    return created(res, result);
});

app.get("/api/reports/:id", requireAuth, async (req, res) => {
    const q = await query(`
        SELECT
            id,
            author_id AS "authorId",
            type,
            description,
            image_ref AS "imageRef",
            COALESCE(image_url, image_ref) AS "imageUrl",
            status,
            created_at AS "createdAt",
            ST_X(location::geometry) AS lon,
            ST_Y(location::geometry) AS lat
        FROM reports
        WHERE id = $1
    `, [req.params.id]);
    if (!q.success || q.data.rows.length === 0) return res.status(404).json({ error: "Report not found." });
    const report = q.data.rows[0];
    return res.json({
        ...report,
        imageRef: normalizeImageUrl(report.imageRef),
        imageUrl: normalizeImageUrl(report.imageUrl),
        location: { lat: Number(report.lat), lon: Number(report.lon) },
    });
});

app.patch("/api/reports/:id/status", requireAuth, requireAdmin, async (req, res) => {
    const { status, expectedVersion } = req.body;
    const result = await transitionReportStatus(req.params.id, status, req.user.userId, expectedVersion ?? null);
    return send(res, result);
});

app.post("/api/reports/:id/verify", requireAuth, requireAdmin, async (req, res) => {
    const result = await adminVerifyReport(req.params.id, req.user.userId);
    if (result.success) req.app.get("io").emit("report:verified", result.data);
    return send(res, result);
});

app.post("/api/reports/:id/reject", requireAuth, requireAdmin, async (req, res) => {
    const result = await adminRejectReport(req.params.id, req.user.userId);
    return send(res, result);
});

app.delete("/api/reports/:id/cancel", requireAuth, async (req, res) => {
    const reportRes = await query(`SELECT id, author_id FROM reports WHERE id = $1`, [req.params.id]);
    if (!reportRes.success) {
        return res.status(500).json({ error: `Failed to load report: ${reportRes.error}` });
    }

    const report = reportRes.data.rows[0];
    if (!report) {
        return res.status(404).json({ error: "Report not found." });
    }
    // Match resolve/delete ownership checks so only the owner or an admin can retract.
    if (req.user.role !== "admin" && report.author_id !== req.user.userId) {
        return res.status(403).json({ error: "Only the report owner can retract this report." });
    }

    const result = await cancelReport(req.params.id, req.user.userId);
    return send(res, result);
});

app.patch("/api/reports/:id/resolve", requireAuth, async (req, res) => {
    const reportRes = await query(`
        SELECT
            id,
            author_id,
            status,
            COALESCE(image_url, image_ref) AS "imageUrl",
            description,
            type,
            created_at AS "createdAt",
            ST_X(location::geometry) AS lon,
            ST_Y(location::geometry) AS lat
        FROM reports
        WHERE id = $1
    `, [req.params.id]);

    if (!reportRes.success) {
        return res.status(500).json({ error: `Failed to load report: ${reportRes.error}` });
    }

    const report = reportRes.data.rows[0];
    if (!report) {
        return res.status(404).json({ error: "Report not found." });
    }
    if (req.user.role !== "admin" && report.author_id !== req.user.userId) {
        return res.status(403).json({ error: "Only the report owner can resolve this report." });
    }

    const updateRes = await query(
        `UPDATE reports SET status = 'resolved' WHERE id = $1 RETURNING id, status`,
        [req.params.id]
    );
    if (!updateRes.success) {
        return res.status(500).json({ error: `Failed to resolve report: ${updateRes.error}` });
    }

    const responderState = getCommunityResponderState(req.params.id);
    req.app.get("io").emit("report:resolved", { id: req.params.id, status: "resolved" });
    return res.json({
        id: req.params.id,
        status: "resolved",
        responderId: responderState.responderId,
        responderCount: responderState.responderCount,
    });
});

app.delete("/api/reports/:id", requireAuth, async (req, res) => {
    const reportRes = await query(`SELECT id, author_id FROM reports WHERE id = $1`, [req.params.id]);
    if (!reportRes.success) {
        return res.status(500).json({ error: `Failed to load report: ${reportRes.error}` });
    }

    const report = reportRes.data.rows[0];
    if (!report) {
        return res.status(404).json({ error: "Report not found." });
    }
    if (req.user.role !== "admin" && report.author_id !== req.user.userId) {
        return res.status(403).json({ error: "Only the report owner can delete this report." });
    }

    const deleteRes = await query(`DELETE FROM reports WHERE id = $1`, [req.params.id]);
    if (!deleteRes.success) {
        return res.status(500).json({ error: `Failed to delete report: ${deleteRes.error}` });
    }

    communityResponders.delete(req.params.id);
    req.app.get("io").emit("report:deleted", { id: req.params.id });
    return res.json({ success: true, id: req.params.id });
});

app.post("/api/ratings", requireAuth, async (req, res) => {
    const { reportId, rating } = req.body ?? {};
    const normalizedRating = Number(rating);

    if (!reportId || !Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
        return res.status(400).json({ error: "reportId and rating (1-5) are required." });
    }

    const reportRes = await query(`SELECT id, author_id, status FROM reports WHERE id = $1`, [reportId]);
    if (!reportRes.success) {
        return res.status(500).json({ error: `Failed to load report: ${reportRes.error}` });
    }

    const report = reportRes.data.rows[0];
    if (!report) {
        return res.status(404).json({ error: "Report not found." });
    }
    if (req.user.role !== "admin" && report.author_id !== req.user.userId) {
        return res.status(403).json({ error: "Only the report owner can rate a responder." });
    }
    if (report.status !== "resolved") {
        return res.status(400).json({ error: "The report must be resolved before it can be rated." });
    }

    const responderState = getCommunityResponderState(reportId);
    if (!responderState.responderId) {
        return res.status(400).json({ error: "No responder is recorded for this report yet." });
    }

    const ratingRes = await query(`
        INSERT INTO ratings (report_id, user_id, rating)
        VALUES ($1, $2, $3)
        ON CONFLICT (report_id, user_id) DO UPDATE SET
            rating = EXCLUDED.rating,
            created_at = NOW()
        RETURNING id, report_id AS "reportId", user_id AS "userId", rating, created_at AS "createdAt"
    `, [reportId, responderState.responderId, normalizedRating]);

    if (!ratingRes.success) {
        return res.status(500).json({ error: `Failed to save rating: ${ratingRes.error}` });
    }

    return res.status(201).json(ratingRes.data.rows[0]);
});

app.get("/api/users/:id/reports", requireAuth, requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
    const result = await getReportsByUser(req.params.id, parseInt(req.query.page || "1", 10));
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
    const q = await query(`
        SELECT
            id,
            requester_id,
            type,
            urgency,
            description,
            image_url AS "imageUrl",
            status,
            created_at AS "createdAt",
            ST_X(location::geometry) AS lon,
            ST_Y(location::geometry) AS lat
        FROM sos_requests
        WHERE id = $1
    `, [req.params.id]);
    if (!q.success || q.data.rows.length === 0) return res.status(404).json({ error: "SOS not found." });

    const sos = q.data.rows[0];
    if (req.user.role !== "admin" && sos.requester_id !== req.user.userId) {
        return res.status(403).json({ error: "Forbidden." });
    }
    return res.json({
        ...sos,
        location: { lat: Number(sos.lat), lon: Number(sos.lon) },
    });
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

app.patch("/api/sos/:id/resolve", requireAuth, async (req, res) => {
    const q = await query(`SELECT id, requester_id FROM sos_requests WHERE id = $1`, [req.params.id]);
    if (!q.success) {
        return res.status(500).json({ error: `Failed to load SOS request: ${q.error}` });
    }

    const sos = q.data.rows[0];
    if (!sos) {
        return res.status(404).json({ error: "SOS not found." });
    }
    if (req.user.role !== "admin" && sos.requester_id !== req.user.userId) {
        return res.status(403).json({ error: "Only the requester can resolve this SOS." });
    }

    const result = await updateSosStatus(req.params.id, "resolved");
    if (result.success) req.app.get("io").emit("sos:updated", result.data);
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
app.get("/api/users/:id/settings", requireAuth, requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
    await ensureUserSettingsRow(req.params.id);
    const settingsRes = await query(`
        SELECT notifications, report_status_updates, community_updates, share_location, anonymous_reports
        FROM user_settings
        WHERE user_id = $1
    `, [req.params.id]);

    if (!settingsRes.success) {
        return res.status(500).json({ error: `Failed to load settings: ${settingsRes.error}` });
    }

    return res.json(serializeSettings(settingsRes.data.rows[0]));
});

app.patch("/api/users/:id/settings", requireAuth, requireOwnerOrAdmin((req) => req.params.id), async (req, res) => {
    const { nextSettings, updateRes } = await upsertUserSettings(req.params.id, req.body);
    if (!updateRes.success) {
        return res.status(500).json({ error: `Failed to update settings: ${updateRes.error}` });
    }

    log("info", "user.settings_updated", { userId: req.params.id, settings: nextSettings });
    return res.json(serializeSettings(updateRes.data.rows[0]));
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
    const { lat, lon, radius = 12 } = req.query;
    const result = await getCrowdZones(
        lat !== undefined ? parseFloat(lat) : undefined,
        lon !== undefined ? parseFloat(lon) : undefined,
        parseFloat(radius)
    );
    return send(res, result);
});

// ─── Accessibility Resources Route ───────────────────────────────────────────
app.get("/api/accessibility/resources", requireAuth, async (req, res) => {
    const { lat, lon, radius = 8 } = req.query;
    const result = await getAccessibilityResources(
        parseFloat(lat),
        parseFloat(lon),
        parseFloat(radius)
    );
    return send(res, result);
});

// ─── Community Feed ───────────────────────────────────────────────────────────
app.get("/api/community/feed", requireAuth, async (_req, res) => {
    const reportsResult = await query(`
        SELECT
            r.id,
            r.type,
            r.description,
            COALESCE(r.image_url, r.image_ref) AS "imageUrl",
            r.status,
            ST_Y(r.location::geometry) AS lat,
            ST_X(r.location::geometry) AS lon,
            r.created_at AS "createdAt",
            r.author_id AS "userId"
        FROM reports r
        WHERE r.status NOT IN ('resolved', 'cancelled')
        ORDER BY r.created_at DESC
        LIMIT 100
    `);

    if (!reportsResult.success) {
        log("error", "community.feed.reports_query_failed", { error: reportsResult.error });
        return res.status(500).json({ error: `Failed to load community reports: ${reportsResult.error}` });
    }

    const sosResult = await query(`
        SELECT
            s.id,
            s.type,
            s.urgency,
            s.description,
            s.image_url AS "imageUrl",
            s.status,
            ST_Y(s.location::geometry) AS lat,
            ST_X(s.location::geometry) AS lon,
            s.created_at AS "createdAt",
            s.requester_id AS "userId"
        FROM sos_requests s
        WHERE s.status IN ('pending', 'under_review')
        ORDER BY s.created_at DESC
        LIMIT 100
    `);

    if (!sosResult.success) {
        log("error", "community.feed.sos_query_failed", { error: sosResult.error });
        return res.status(500).json({ error: `Failed to load SOS requests: ${sosResult.error}` });
    }

    const reports = reportsResult.data.rows.map((row) => {
        const responderState = getCommunityResponderState(row.id);

        return {
            id: row.id,
            _type: "report",
            description: row.description,
            type: row.type,
            status: normalizeCommunityReportStatus(row.status, responderState.responderCount),
            imageUrl: normalizeImageUrl(row.imageUrl),
            location: { lat: Number(row.lat), lon: Number(row.lon) },
            createdAt: row.createdAt,
            userId: row.userId,
            responderId: responderState.responderId,
            responderCount: responderState.responderCount,
        };
    });

    const sosRequests = sosResult.data.rows.map((row) => {
        const responderState = getCommunityResponderState(row.id);

        return {
            id: row.id,
            _type: "sos",
            description: row.description,
            type: row.type,
            urgency: row.urgency,
            status: normalizeCommunitySosStatus(row.status, responderState.responderCount),
            imageUrl: normalizeImageUrl(row.imageUrl),
            location: { lat: Number(row.lat), lon: Number(row.lon) },
            createdAt: row.createdAt,
            userId: row.userId,
            responderId: responderState.responderId,
            responderCount: responderState.responderCount,
        };
    });

    const feed = [...sosRequests, ...reports].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json(feed);
});

app.post("/api/community/respond", requireAuth, async (req, res) => {
    const { requestId, type } = req.body ?? {};

    if (!requestId || !["sos", "report"].includes(type)) {
        return res.status(400).json({ error: "requestId and a valid type are required." });
    }

    const table = type === "sos" ? "sos_requests" : "reports";
    const allowedStatuses = type === "sos"
        ? ["pending", "under_review"]
        : ["under_review", "verified", "rejected"];

    const lookupResult = await query(
        `SELECT id, status FROM ${table} WHERE id = $1`,
        [requestId]
    );

    if (!lookupResult.success) {
        log("error", "community.respond.lookup_failed", { requestId, type, error: lookupResult.error });
        return res.status(500).json({ error: `Failed to load ${type} request: ${lookupResult.error}` });
    }

    const item = lookupResult.data.rows[0];
    if (!item) {
        return res.status(404).json({ error: "Request not found." });
    }

    if (!allowedStatuses.includes(item.status)) {
        return res.status(400).json({ error: "This request is no longer active." });
    }

    const existingState = communityResponders.get(requestId) ?? { responderIds: new Set() };
    existingState.responderIds.add(req.user.userId);
    communityResponders.set(requestId, existingState);

    if (type === "sos" && item.status === "pending") {
        const updateResult = await query(
            `UPDATE sos_requests SET status = 'under_review' WHERE id = $1`,
            [requestId]
        );

        if (!updateResult.success) {
            log("error", "community.respond.sos_update_failed", { requestId, error: updateResult.error });
            return res.status(500).json({ error: `Failed to update SOS request: ${updateResult.error}` });
        }
    }

    const responderState = getCommunityResponderState(requestId);
    req.app.get("io").emit("community:response", {
        requestId,
        type,
        responderId: responderState.responderId,
        responderCount: responderState.responderCount,
    });

    return res.json({
        success: true,
        message: "You are now responding to this request",
        data: {
            requestId,
            type,
            responderId: responderState.responderId,
            responderCount: responderState.responderCount,
            status: "in_progress",
        },
    });
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
    if (err instanceof multer.MulterError || err.status === 400) {
        return res.status(400).json({ error: err.message });
    }
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

const startServer = async () => {
    try {
        await ensureRuntimeSchema();
        httpServer.listen(PORT, () => {
            log("info", "server.started", { port: PORT, mode: process.env.NODE_ENV ?? "development" });
            console.log(`\n🚀  CitySafe API running → http://localhost:${PORT}\n`);
        });
    } catch (error) {
        log("error", "server.bootstrap_failed", { message: error.message });
        process.exit(1);
    }
};

if (process.env.NODE_ENV !== "test") {
    startServer();
}

export { app, httpServer, startServer };

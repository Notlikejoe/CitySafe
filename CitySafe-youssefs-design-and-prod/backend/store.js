/**
 * CitySafe In-Memory Data Store
 *
 * Fixes applied (v2 audit):
 * #2 — Spatial indices (SpatialIndex) exported for O(k) nearby queries.
 * #3 — bumpVersion() helper for optimistic-locking pattern on every mutation.
 * #7 — JSON file persistence: store is loaded from disk on startup and
 *       written back (debounced) after every mutation.
 *
 * Persistence is gated behind PERSIST_STORE=true to keep the test runner clean.
 */

import { SpatialIndex, log, readFileSync, writeFileSync, existsSync, renameSync } from "./utils.js";

// ─── Persistence Config ───────────────────────────────────────────────────────
const PERSIST = process.env.PERSIST_STORE === "true";
const STORE_PATH = "./citysafe-store.json";
let _persistTimer = null;

// ─── Default (empty) state ────────────────────────────────────────────────────
const defaultStore = () => ({
    reports: [],
    alerts: [],
    sosRequests: [],
    pointsLedger: [],
    vouchers: [],
    users: {},
    userSettings: {},
});

// ─── In-Memory Store ──────────────────────────────────────────────────────────
export const store = defaultStore();

// ─── Spatial Indices — Fix #2 ─────────────────────────────────────────────────
/** Index of all reports by location — rebuilt on load. */
export const reportIndex = new SpatialIndex(0.1);  // 0.1° ≈ 11 km grid cells
/** Index of all alerts by location — rebuilt on load. */
export const alertIndex = new SpatialIndex(0.1);

// ─── User Indices — Fix #8 ────────────────────────────────────────────────────
export const userIndices = {
    reports: new Map(), // userId -> array of report refs
    sos: new Map(),
    points: new Map(),
    vouchers: new Map(),
};

export const insertUserEntity = (userId, type, entity) => {
    if (!userId) return;
    if (!userIndices[type].has(userId)) userIndices[type].set(userId, []);
    userIndices[type].get(userId).push(entity);
};

export const rebuildUserIndices = () => {
    userIndices.reports.clear(); userIndices.sos.clear();
    userIndices.points.clear(); userIndices.vouchers.clear();
    store.reports.forEach((r) => insertUserEntity(r.userId, "reports", r));
    store.sosRequests.forEach((s) => insertUserEntity(s.userId, "sos", s));
    store.pointsLedger.forEach((p) => insertUserEntity(p.userId, "points", p));
    store.vouchers.forEach((v) => insertUserEntity(v.userId, "vouchers", v));
};

// ─── Version Helper — Fix #3 ──────────────────────────────────────────────────
/**
 * Increments the version counter on an entity after every mutation.
 * Provides a hook for future optimistic-locking in DB adapters:
 * callers can check `entity.version` before and after a read-modify-write
 * to detect concurrent modifications.
 */
export const bumpVersion = (entity) => {
    entity.version = (entity.version ?? 0) + 1;
};

// ─── Reset (used by test runner) ─────────────────────────────────────────────
/**
 * Resets the store to a completely clean state.
 * Called at the top of the test suite to ensure deterministic runs
 * regardless of any previous persistence on disk.
 */
export const resetStore = () => {
    const clean = defaultStore();
    Object.assign(store, clean);
    // Clear indices
    reportIndex.cells.clear(); reportIndex.positions.clear();
    alertIndex.cells.clear(); alertIndex.positions.clear();
    rebuildUserIndices();
    log("info", "store.reset", {});
};

// ─── Persistence helpers — Fix #7 ────────────────────────────────────────────
/**
 * Loads state from disk (called once on startup when PERSIST_STORE=true).
 * Also rebuilds spatial indices from persisted data.
 */
export const loadStore = () => {
    if (!PERSIST || !existsSync(STORE_PATH)) return;
    try {
        const raw = readFileSync(STORE_PATH, "utf-8");
        const saved = JSON.parse(raw);
        Object.assign(store, saved);
        // Re-build spatial indices from persisted entities
        store.reports.forEach((r) => reportIndex.insert(r.id, r.location.lat, r.location.lon));
        store.alerts.forEach((a) => alertIndex.insert(a.id, a.location.lat, a.location.lon));
        rebuildUserIndices();
        log("info", "store.loaded", { path: STORE_PATH, reports: store.reports.length, alerts: store.alerts.length });
    } catch (e) {
        log("error", "store.load_failed", { message: e.message });
    }
};

/**
 * Writes the current store to disk.
 * Converts Set → serialisable arrays transparently by using JSON.stringify default.
 */
const persistNow = () => {
    try {
        const tmpPath = `${STORE_PATH}.tmp`;
        writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf-8");
        renameSync(tmpPath, STORE_PATH);
    } catch (e) {
        log("error", "store.persist_failed", { message: e.message });
    }
};

/**
 * Schedules a debounced write (100 ms) so rapid consecutive mutations
 * only trigger a single disk write.
 */
export const schedulePersist = () => {
    if (!PERSIST) return;
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(persistNow, 100);
};

// ─── Load on startup ──────────────────────────────────────────────────────────
loadStore();

// ─── Status Enums ─────────────────────────────────────────────────────────────
export const REPORT_STATUS = Object.freeze({
    SUBMITTED: "submitted",
    UNDER_REVIEW: "under_review",
    VERIFIED: "verified",
    REJECTED: "rejected",
    RESOLVED: "resolved",
    CANCELLED: "cancelled",
});

export const SOS_STATUS = Object.freeze({
    PENDING: "pending",
    ACCEPTED: "accepted",
    IN_PROGRESS: "in_progress",
    RESOLVED: "resolved",
    CANCELLED: "cancelled",
});

export const ALERT_PRIORITY = Object.freeze({
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    EMERGENCY: "emergency",
});

export const ALERT_TYPE = Object.freeze({
    FLOODING: "flooding",
    CONSTRUCTION: "construction",
    ROAD_CLOSURE: "road_closure",
    EMERGENCY: "emergency_notice",
});

export const REPORT_TYPE = Object.freeze({
    CONSTRUCTION: "construction",
    FLOODING: "flooding",
    POTHOLE: "pothole",
    FIRE: "fire",
    CRIME: "crime",
    OTHER: "other",
});

export const SOS_TYPE = Object.freeze({
    MEDICAL: "medical",
    CAR_TROUBLE: "car_trouble",
    ELECTRICIAN: "electrician",
    OTHER: "other",
});

export const SOS_URGENCY = Object.freeze({
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
});

// ─── Valid Status Transitions ─────────────────────────────────────────────────
export const REPORT_TRANSITIONS = Object.freeze({
    [REPORT_STATUS.SUBMITTED]: [REPORT_STATUS.UNDER_REVIEW, REPORT_STATUS.REJECTED, REPORT_STATUS.CANCELLED],
    [REPORT_STATUS.UNDER_REVIEW]: [REPORT_STATUS.VERIFIED, REPORT_STATUS.REJECTED, REPORT_STATUS.CANCELLED],
    [REPORT_STATUS.VERIFIED]: [REPORT_STATUS.RESOLVED],
    [REPORT_STATUS.REJECTED]: [],
    [REPORT_STATUS.RESOLVED]: [],
    [REPORT_STATUS.CANCELLED]: [],
});

export const SOS_TRANSITIONS = Object.freeze({
    [SOS_STATUS.PENDING]: [SOS_STATUS.ACCEPTED, SOS_STATUS.CANCELLED],
    [SOS_STATUS.ACCEPTED]: [SOS_STATUS.IN_PROGRESS, SOS_STATUS.CANCELLED],
    [SOS_STATUS.IN_PROGRESS]: [SOS_STATUS.RESOLVED, SOS_STATUS.CANCELLED],
    [SOS_STATUS.RESOLVED]: [],
    [SOS_STATUS.CANCELLED]: [],
});

// ─── Points Configuration ─────────────────────────────────────────────────────
export const POINTS_CONFIG = Object.freeze({
    REPORT_VERIFIED: 50,
    SOS_VALID_USAGE: 20,
    VOUCHER_THRESHOLD: 200,
    VOUCHER_COST: 200,
});

// ─── Voucher Configuration ────────────────────────────────────────────────────
export const VOUCHER_CONFIG = Object.freeze({
    EXPIRY_DAYS: 30,
});

// ─── SOS Throttle Configuration ───────────────────────────────────────────────
export const SOS_THROTTLE_CONFIG = Object.freeze({
    MAX_ACTIVE_PER_USER: 1,
    COOLDOWN_MINUTES: 30,
    EMERGENCY_BYPASS_COOLDOWN: true,
});

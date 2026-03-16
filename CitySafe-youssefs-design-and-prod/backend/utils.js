/**
 * CitySafe Utility Functions
 */

import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ─── ID Generation ────────────────────────────────────────────────────────────
export const generateId = () => randomUUID();

// ─── Timestamps ───────────────────────────────────────────────────────────────
export const getTimestamp = () => new Date().toISOString();

// ─── Geospatial ───────────────────────────────────────────────────────────────
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const toRad = (deg) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const isValidLocation = (location) =>
    location &&
    typeof location.lat === "number" &&
    typeof location.lon === "number" &&
    location.lat >= -90 && location.lat <= 90 &&
    location.lon >= -180 && location.lon <= 180;

// ─── Date Helpers ─────────────────────────────────────────────────────────────
export const addDays = (fromDate, days) => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + days);
    return d.toISOString();
};

export const minutesBetween = (earlier, later) =>
    (new Date(later) - new Date(earlier)) / 60_000;

// ─── Input Sanitization — Fix #5 ─────────────────────────────────────────────
/**
 * Strips HTML/script tags from user-supplied strings to prevent XSS.
 * Also collapses consecutive whitespace to a single space.
 * @param {string} str
 * @returns {string}
 */
export const sanitize = (str) =>
    typeof str === "string"
        ? str.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
        : "";

// ─── Spatial Grid Index — Fix #2 ─────────────────────────────────────────────
/**
 * In-memory spatial grid index.
 * Divides the world into cells of `cellSizeDeg` degrees (~11 km at 0.1°).
 *
 * insert / remove are O(1).
 * query is O(k) where k = items actually within the queried cells,
 * vs O(N) for a full linear scan of the entire dataset.
 *
 * After a grid-based pre-filter, callers still do an exact Haversine check
 * on the smaller candidate set before returning results to users.
 */
export class SpatialIndex {
    constructor(cellSizeDeg = 0.1) {
        this.cellSize = cellSizeDeg;
        this.cells = new Map();  // "cLat:cLon" → Set<id>
        this.positions = new Map();  // id → { lat, lon }
    }

    _key(lat, lon) {
        const cLat = Math.floor(lat / this.cellSize);
        const cLon = Math.floor(lon / this.cellSize);
        return `${cLat}:${cLon}`;
    }

    insert(id, lat, lon) {
        const key = this._key(lat, lon);
        if (!this.cells.has(key)) this.cells.set(key, new Set());
        this.cells.get(key).add(id);
        this.positions.set(id, { lat, lon });
    }

    remove(id) {
        const pos = this.positions.get(id);
        if (!pos) return;
        this.cells.get(this._key(pos.lat, pos.lon))?.delete(id);
        this.positions.delete(id);
    }

    /**
     * Returns a Set of candidate IDs whose grid cells overlap the query radius.
     * Callers must still run an exact distance check on the returned candidates.
     */
    query(lat, lon, radiusKm) {
        const degPerKm = 1 / 111;
        const latDelta = radiusKm * degPerKm;
        const lonDelta = radiusKm * degPerKm / Math.cos(lat * (Math.PI / 180));

        const minCLat = Math.floor((lat - latDelta) / this.cellSize);
        const maxCLat = Math.floor((lat + latDelta) / this.cellSize);
        const minCLon = Math.floor((lon - lonDelta) / this.cellSize);
        const maxCLon = Math.floor((lon + lonDelta) / this.cellSize);

        const candidates = new Set();
        for (let cLat = minCLat; cLat <= maxCLat; cLat++) {
            for (let cLon = minCLon; cLon <= maxCLon; cLon++) {
                this.cells.get(`${cLat}:${cLon}`)?.forEach((id) => candidates.add(id));
            }
        }
        return candidates;
    }
}

// ─── Result Helpers ───────────────────────────────────────────────────────────
export const ok = (data) => ({ success: true, data });
export const err = (message) => ({ success: false, error: message });

// ─── Centralized Error Boundary — Fix #6 ────────────────────────────────────
/**
 * Wraps a synchronous function and catches any unhandled exceptions.
 * Returns a standardised err() instead of crashing the process.
 * Apply to all public module entry points.
 *
 * @param {() => any} fn  Function to execute
 * @param {string} context  Human-readable location for logs (e.g. "reports.create")
 */
export const tryCatch = (fn, context = "unknown") => {
    try {
        return fn();
    } catch (e) {
        log("error", "unhandled_exception", { context, message: e?.message, stack: e?.stack });
        return err(`Unexpected error in [${context}]. Check server logs.`);
    }
};

// ─── Pagination ───────────────────────────────────────────────────────────────
export const paginate = (arr, page = 1, pageSize = 20) => {
    const total = arr.length;
    const totalPages = Math.ceil(total / pageSize);
    const items = arr.slice((page - 1) * pageSize, page * pageSize);
    return { items, page, pageSize, total, totalPages };
};

// ─── Schema Validation — Fix #3 ──────────────────────────────────────────────
/**
 * Unified field validator. Each field spec:
 *   { value, required?, type?, min?, max?, label? }
 *
 * - type: "string" (default) | "number"
 * - min / max: character count for strings, numeric range for numbers
 * - required: defaults to true
 *
 * Returns err(message) on the first violation, or null if all fields pass.
 *
 * @param {Record<string, object>} fields
 * @returns {{ success: false, error: string } | null}
 */
export const validateFields = (fields) => {
    for (const [name, opts] of Object.entries(fields)) {
        const { value, required = true, type = "string", min, max, label = name } = opts;

        // Required check
        if (required && (value === undefined || value === null || value === "")) {
            return err(`'${label}' is required.`);
        }
        if (value === undefined || value === null) continue;  // optional, skip further checks

        // Type check
        if (type === "string" && typeof value !== "string") return err(`'${label}' must be a string.`);
        if (type === "number" && typeof value !== "number") return err(`'${label}' must be a number.`);

        // String length bounds
        if (type === "string") {
            if (min !== undefined && value.length < min)
                return err(`'${label}' must be at least ${min} character${min === 1 ? "" : "s"}.`);
            if (max !== undefined && value.length > max)
                return err(`'${label}' must not exceed ${max} characters (got ${value.length}).`);
        }
        // Numeric range bounds
        if (type === "number") {
            if (min !== undefined && value < min)
                return err(`'${label}' must be at least ${min}.`);
            if (max !== undefined && value > max)
                return err(`'${label}' must not exceed ${max}.`);
        }
    }
    return null;  // all fields valid
};

// ─── Enum Validation ──────────────────────────────────────────────────────────

export const isValidEnum = (value, enumObj) =>
    Object.values(enumObj).includes(value);

// ─── Structured Logging ───────────────────────────────────────────────────────
export const log = (level, event, meta = {}) => {
    const entry = { ts: getTimestamp(), level, event, ...meta };
    if (level === "error") {
        console.error(JSON.stringify(entry));
    } else {
        console.log(JSON.stringify(entry));
    }
};

// ─── File Helpers (used by store persistence) — Fix #7 ───────────────────────
export { readFileSync, writeFileSync, existsSync };

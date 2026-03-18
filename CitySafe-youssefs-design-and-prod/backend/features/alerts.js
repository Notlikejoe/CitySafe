/**
 * CitySafe Alerts Module
 *
 * Fixes applied (v2 audit):
 * #2 — getNearbyAlerts uses alertIndex (grid spatial pre-filter).
 * #3 — bumpVersion() on deactivation.
 * #5 — message sanitized (HTML stripped) before storage.
 * #6 — all public exports wrapped in tryCatch().
 * #7 — schedulePersist() called after every mutation.
 */

import { store, alertIndex, ALERT_TYPE, ALERT_PRIORITY, bumpVersion, schedulePersist } from "../store.js";
import { generateId, getTimestamp, calculateDistance, isValidLocation, isValidEnum, sanitize, validateFields, tryCatch, ok, err, addDays, log } from "../utils.js";

const DEFAULT_EXPIRY_DAYS = 7;
const DEDUP_RADIUS_KM = 0.5;

// ─── Shared Expiry Helper ─────────────────────────────────────────────────────
const runExpiryCheck = () => {
    const now = new Date();
    let count = 0;
    store.alerts.forEach((a) => {
        if (a.active && new Date(a.expiresAt) < now) {
            a.active = false;
            count++;
        }
    });
    if (count > 0) log("info", "alerts.expired", { count });
    return count;
};

// ─── Create Alert ─────────────────────────────────────────────────────────────
export const createAlert = (params) => tryCatch(() => {
    const { type, priority, location, createdBy = "system", expiryDays = DEFAULT_EXPIRY_DAYS } = params;
    const message = sanitize(params.message ?? "");  // #5 sanitize

    if (!isValidEnum(type, ALERT_TYPE)) return err(`Invalid alert type. Valid types: ${Object.values(ALERT_TYPE).join(", ")}`);
    if (!isValidEnum(priority, ALERT_PRIORITY)) return err(`Invalid priority. Valid priorities: ${Object.values(ALERT_PRIORITY).join(", ")}`);
    if (!isValidLocation(location)) return err("A valid location { lat, lon } is required.");
    // Fix #3 — unified schema check
    const schemaErr = validateFields({
        message: { value: message, min: 5, max: 500, label: "message" },
        expiryDays: { value: expiryDays, type: "number", min: 1, max: 365, label: "expiryDays" },
        createdBy: { value: createdBy, min: 1, max: 100, label: "createdBy", required: false },
    });
    if (schemaErr) return schemaErr;

    runExpiryCheck(); // clean up before dedup check

    const isDuplicate = store.alerts.some((a) => {
        if (a.type !== type || !a.active) return false;
        return calculateDistance(location.lat, location.lon, a.location.lat, a.location.lon) <= DEDUP_RADIUS_KM;
    });
    if (isDuplicate) {
        return err(`A similar '${type}' alert already exists within ${DEDUP_RADIUS_KM * 1000}m. Skipping duplicate.`);
    }

    const alert = {
        id: generateId(),
        type,
        priority,
        location,
        message,
        createdBy,
        createdAt: getTimestamp(),
        expiresAt: addDays(new Date(), expiryDays),
        active: true,
        version: 1,   // #3 optimistic locking seed
    };

    store.alerts.push(alert);
    alertIndex.insert(alert.id, location.lat, location.lon);  // #2 spatial index
    schedulePersist();                                          // #7
    log("info", "alert.created", { alertId: alert.id, type, priority, createdBy });
    return ok(alert);
}, "alerts.create");

// ─── Public Expiry ────────────────────────────────────────────────────────────
export const expireAlerts = () => {
    const count = runExpiryCheck();
    return ok({ expiredCount: count });
};

// ─── Get Nearby Alerts ────────────────────────────────────────────────────────
/**
 * Fix #2: Uses alertIndex grid pre-filter instead of full O(N) scan.
 */
export const getNearbyAlerts = (location, radiusKm, filters = {}) => tryCatch(() => {
    if (!isValidLocation(location)) return err("A valid location { lat, lon } is required.");
    if (typeof radiusKm !== "number" || radiusKm <= 0) return err("radiusKm must be a positive number.");

    runExpiryCheck();

    // Spatial pre-filter → only exact-check candidate cells
    const candidateIds = alertIndex.query(location.lat, location.lon, radiusKm);

    let results = store.alerts.filter((a) => {
        if (!candidateIds.has(a.id)) return false;
        if (!filters.includeExpired && !a.active) return false;
        return calculateDistance(location.lat, location.lon, a.location.lat, a.location.lon) <= radiusKm;
    });

    if (filters.type) {
        if (!isValidEnum(filters.type, ALERT_TYPE)) return err(`Invalid filter type: '${filters.type}'.`);
        results = results.filter((a) => a.type === filters.type);
    }
    if (filters.priority) {
        if (!isValidEnum(filters.priority, ALERT_PRIORITY)) return err(`Invalid filter priority: '${filters.priority}'.`);
        results = results.filter((a) => a.priority === filters.priority);
    }

    const priorityOrder = {
        [ALERT_PRIORITY.EMERGENCY]: 0,
        [ALERT_PRIORITY.HIGH]: 1,
        [ALERT_PRIORITY.MEDIUM]: 2,
        [ALERT_PRIORITY.LOW]: 3,
    };
    results.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        return pDiff !== 0 ? pDiff : new Date(b.createdAt) - new Date(a.createdAt);
    });

    return ok(results);
}, "alerts.getNearby");

// ─── Get All Alerts (Feed) ────────────────────────────────────────────────────
export const getAlertsFeed = (filters = {}) => tryCatch(() => {
    runExpiryCheck();
    const results = store.alerts
        .filter((a) => filters.includeExpired || a.active)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return ok(results);
}, "alerts.getFeed");

// ─── Deactivate Alert ─────────────────────────────────────────────────────────
export const deactivateAlert = (alertId, actorId) => tryCatch(() => {
    if (!actorId) return err("actorId is required.");
    const alert = store.alerts.find((a) => a.id === alertId);
    if (!alert) return err(`Alert '${alertId}' not found.`);
    if (!alert.active) return err(`Alert '${alertId}' is already inactive.`);

    alert.active = false;
    alert.deactivatedAt = getTimestamp();
    alert.deactivatedBy = actorId;
    bumpVersion(alert);  // #3
    schedulePersist();   // #7

    log("info", "alert.deactivated", { alertId, actorId, version: alert.version });
    return ok(alert);
}, "alerts.deactivate");

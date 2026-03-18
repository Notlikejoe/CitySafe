/**
 * CitySafe SOS Module
 *
 * Fixes applied (v2 audit):
 * #3 — bumpVersion() on every status transition.
 * #5 — description sanitized (HTML stripped).
 * #6 — all public exports wrapped in tryCatch().
 * #7 — schedulePersist() called after every mutation.
 */

import { store, insertUserEntity, SOS_STATUS, SOS_TRANSITIONS, SOS_TYPE, SOS_URGENCY, SOS_THROTTLE_CONFIG, bumpVersion, schedulePersist } from "../store.js";
import { generateId, getTimestamp, isValidLocation, isValidEnum, minutesBetween, sanitize, validateFields, tryCatch, ok, err, log } from "../utils.js";
import { awardPoints } from "./points.js";

// ─── Throttle Check ───────────────────────────────────────────────────────────
const checkThrottle = (userId, sosType) => {
    const userSos = store.sosRequests.filter((s) => s.userId === userId);

    const active = userSos.find((s) =>
        [SOS_STATUS.PENDING, SOS_STATUS.ACCEPTED, SOS_STATUS.IN_PROGRESS].includes(s.status)
    );
    if (active) {
        log("warn", "sos.throttle_active", { userId, activeId: active.id, activeStatus: active.status });
        return err(`You already have an active SOS request (ID: ${active.id}, status: ${active.status}). Only ${SOS_THROTTLE_CONFIG.MAX_ACTIVE_PER_USER} active SOS allowed.`);
    }

    const isMedical = sosType === SOS_TYPE.MEDICAL;
    if (!(isMedical && SOS_THROTTLE_CONFIG.EMERGENCY_BYPASS_COOLDOWN)) {
        const lastResolved = userSos
            .filter((s) => [SOS_STATUS.RESOLVED, SOS_STATUS.CANCELLED].includes(s.status))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];

        if (lastResolved) {
            const minutesSince = minutesBetween(lastResolved.updatedAt, getTimestamp());
            if (minutesSince < SOS_THROTTLE_CONFIG.COOLDOWN_MINUTES) {
                const remaining = Math.ceil(SOS_THROTTLE_CONFIG.COOLDOWN_MINUTES - minutesSince);
                log("warn", "sos.throttle_cooldown", { userId, remainingMinutes: remaining });
                return err(`SOS cooldown active. Please wait ${remaining} more minute(s).`);
            }
        }
    }
    return null;
};

// ─── Create SOS ───────────────────────────────────────────────────────────────
export const createSos = (params) => tryCatch(() => {
    const { userId, type, location, urgency } = params;
    const description = sanitize(params.description ?? "");

    // Fix #3 — unified schema check
    const schemaErr = validateFields({
        userId: { value: userId, min: 1, max: 100 },
        description: { value: description, min: 0, max: 1000, required: false },
    });
    if (schemaErr) return schemaErr;

    if (!isValidEnum(type, SOS_TYPE)) return err(`Invalid SOS type. Valid types: ${Object.values(SOS_TYPE).join(", ")}`);
    if (!isValidLocation(location)) return err("A valid location { lat, lon } is required.");
    if (!isValidEnum(urgency, SOS_URGENCY)) return err(`Invalid urgency. Valid: ${Object.values(SOS_URGENCY).join(", ")}`);

    const throttleError = checkThrottle(userId, type);
    if (throttleError) return throttleError;

    const sos = {
        id: generateId(),
        userId,
        type,
        location,
        urgency,
        description,
        status: SOS_STATUS.PENDING,
        version: 1,   // #3
        statusHistory: [
            { from: null, to: SOS_STATUS.PENDING, at: getTimestamp(), by: userId }
        ],
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
    };

    store.sosRequests.push(sos);
    insertUserEntity(sos.userId, "sos", sos);
    schedulePersist();  // #7
    log("info", "sos.created", { sosId: sos.id, userId, type, urgency, location });
    return ok(sos);
}, "sos.create");

// ─── Transition SOS Status ────────────────────────────────────────────────────
/**
 * Fix #2 — Optimistic locking: pass expectedVersion to guard against
 * concurrent mutations between your read and this write.
 *
 * @param {string} sosId
 * @param {string} newStatus
 * @param {string} actorId
 * @param {number|null} [expectedVersion=null]
 */
export const transitionSosStatus = (sosId, newStatus, actorId, expectedVersion = null) => tryCatch(() => {
    if (!actorId) return err("actorId is required.");

    const sos = store.sosRequests.find((s) => s.id === sosId);
    if (!sos) return err(`SOS '${sosId}' not found.`);
    if (!isValidEnum(newStatus, SOS_STATUS)) return err(`Invalid target status: '${newStatus}'.`);

    // Fix #2 — Optimistic version check
    if (expectedVersion !== null && sos.version !== expectedVersion) {
        return err(
            `Version conflict on SOS '${sosId}': expected v${expectedVersion} but current is v${sos.version}. Re-fetch and retry.`
        );
    }

    const allowed = SOS_TRANSITIONS[sos.status];
    if (!allowed.includes(newStatus)) {
        return err(`Cannot transition SOS from '${sos.status}' to '${newStatus}'. Allowed: [${allowed.join(", ") || "none"}].`);
    }

    const prev = sos.status;
    sos.status = newStatus;
    sos.updatedAt = getTimestamp();
    sos.statusHistory.push({ from: prev, to: newStatus, at: sos.updatedAt, by: actorId });
    bumpVersion(sos);   // #3
    schedulePersist();  // #7

    log("info", "sos.status_changed", { sosId, from: prev, to: newStatus, actorId, version: sos.version });

    if (newStatus === SOS_STATUS.RESOLVED) {
        awardPoints({ userId: sos.userId, reason: "sos_valid_usage", referenceId: sos.id });
    }

    return ok(sos);
}, "sos.transition");

// ─── Get SOS History ──────────────────────────────────────────────────────────
export const getUserSosHistory = (userId, statusFilter = null) => tryCatch(() => {
    if (!userId) return err("userId is required.");

    let results = store.sosRequests.filter((s) => s.userId === userId);
    if (statusFilter) {
        if (!isValidEnum(statusFilter, SOS_STATUS)) return err(`Invalid status filter: '${statusFilter}'.`);
        results = results.filter((s) => s.status === statusFilter);
    }
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return ok(results);
}, "sos.getHistory");

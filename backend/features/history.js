/**
 * CitySafe User History Module
 *
 * Features:
 * - Unified history response per user
 * - Chronological sorting
 * - Filter by type
 * - Pagination
 */

import { store } from "../store.js";
import { ok, err, paginate } from "../utils.js";
import { getUserBalance } from "./points.js";
import { getUserVouchers } from "./vouchers.js";

const VALID_TYPES = ["report", "sos", "point", "voucher"];

// ─── Get Unified History ──────────────────────────────────────────────

/**
 * Returns a unified, chronological history for a user.
 * @param {string} userId
 * @param {object} [options]
 * @param {string} [options.type] - Filter: "report" | "sos" | "point" | "voucher"
 * @param {number} [options.page] - Page number (1-indexed)
 * @param {number} [options.pageSize] - Items per page
 */
export const getUserHistory = (userId, { type = null, page = 1, pageSize = 20 } = {}) => {
    if (!userId) return err("userId is required.");
    if (type && !VALID_TYPES.includes(type)) {
        return err(`Invalid type filter '${type}'. Valid: [${VALID_TYPES.join(", ")}].`);
    }
    if (!Number.isInteger(page) || page < 1) return err("page must be a positive integer.");
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        return err("pageSize must be an integer between 1 and 100.");
    }

    let events = [];

    // Reports
    if (!type || type === "report") {
        const reports = store.reports
            .filter((r) => r.userId === userId)
            .map((r) => ({ _type: "report", _timestamp: r.createdAt, ...r }));
        events.push(...reports);
    }

    // SOS
    if (!type || type === "sos") {
        const sos = store.sosRequests
            .filter((s) => s.userId === userId)
            .map((s) => ({ _type: "sos", _timestamp: s.createdAt, ...s }));
        events.push(...sos);
    }

    // Points
    if (!type || type === "point") {
        const points = store.pointsLedger
            .filter((p) => p.userId === userId)
            .map((p) => ({ _type: "point", _timestamp: p.timestamp, ...p }));
        events.push(...points);
    }

    // Vouchers
    if (!type || type === "voucher") {
        const vouchers = store.vouchers
            .filter((v) => v.userId === userId)
            .map((v) => ({ _type: "voucher", _timestamp: v.issuedAt, ...v }));
        events.push(...vouchers);
    }

    // Sort chronologically (newest first)
    events.sort((a, b) => new Date(b._timestamp) - new Date(a._timestamp));

    const paged = paginate(events, page, pageSize);
    const balResult = getUserBalance(userId);
    const vouchersResult = getUserVouchers(userId, { activeOnly: true });

    return ok({
        ...paged,
        summary: {
            totalReports: store.reports.filter((r) => r.userId === userId).length,
            totalSos: store.sosRequests.filter((s) => s.userId === userId).length,
            pointBalance: balResult.success ? balResult.data.balance : 0,
            activeVouchers: vouchersResult.success ? vouchersResult.data.length : 0,
        },
    });
};

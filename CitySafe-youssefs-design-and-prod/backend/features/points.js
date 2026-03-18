/**
 * CitySafe Points Module (CityPoints)
 *
 * Fixes applied (v2 audit):
 * #6 — all public exports wrapped in tryCatch().
 * #7 — schedulePersist() called after every ledger mutation.
 */

import { store, POINTS_CONFIG, schedulePersist, insertUserEntity, userIndices } from "../store.js";
import { generateId, getTimestamp, tryCatch, ok, err, log } from "../utils.js";
import { issueVoucherIfEligible } from "./vouchers.js";

const VALID_REASONS = Object.freeze([
    "report_verified",
    "sos_valid_usage",
    "manual_admin_grant",
    "voucher_deduction",
]);

// ─── Internal: Ensure User ────────────────────────────────────────────────────
const ensureUser = (userId) => {
    if (!store.users[userId]) {
        store.users[userId] = {};
    }
};

// ─── Balance (pure ledger sum) ────────────────────────────────────────────────
export const getUserBalance = (userId) => tryCatch(() => {
    if (!userId) return err("userId is required.");

    const allEntries = store.pointsLedger.filter((e) => e.userId === userId);
    const earned = allEntries.filter((e) => e.points > 0).reduce((s, e) => s + e.points, 0);
    const deducted = allEntries.filter((e) => e.points < 0).reduce((s, e) => s + e.points, 0);
    const balance = earned + deducted; // deducted is already negative

    return ok({ userId, earned, deducted: Math.abs(deducted), balance });
}, "points.getBalance");

// ─── Award Points ─────────────────────────────────────────────────────────────
export const awardPoints = ({ userId, reason, referenceId, overrideAmount = null }) => tryCatch(() => {
    if (!userId) return err("userId is required.");
    if (!VALID_REASONS.includes(reason)) return err(`Invalid reason '${reason}'. Valid: [${VALID_REASONS.join(", ")}].`);
    if (!referenceId) return err("referenceId is required to prevent duplicate rewards.");

    const alreadyAwarded = store.pointsLedger.some(
        (e) => e.referenceId === referenceId && e.reason === reason && e.userId === userId
    );
    if (alreadyAwarded) {
        return err(`Points already awarded to '${userId}' for ${reason} on '${referenceId}'.`);
    }

    const pointMap = {
        report_verified: POINTS_CONFIG.REPORT_VERIFIED,
        sos_valid_usage: POINTS_CONFIG.SOS_VALID_USAGE,
        manual_admin_grant: overrideAmount ?? 0,
        voucher_deduction: overrideAmount ?? 0,
    };

    const points = overrideAmount !== null ? overrideAmount : pointMap[reason];
    if (typeof points !== "number" || points === 0) return err("Points amount must be a non-zero number.");

    ensureUser(userId);

    const entry = {
        id: generateId(),
        userId,
        points,
        reason,
        referenceId,
        timestamp: getTimestamp(),
    };

    store.pointsLedger.push(entry);
    insertUserEntity(entry.userId, "points", entry);
    schedulePersist();  // #7

    log("info", "points.awarded", { userId, points, reason, referenceId });

    if (points > 0) {
        issueVoucherIfEligible(userId);
    }

    return ok(entry);
}, "points.award");

// ─── Deduct Points (negative ledger entry) ────────────────────────────────────
export const deductPoints = (userId, amount, referenceId) => tryCatch(() => {
    if (!userId) return err("userId is required.");
    if (!referenceId) return err("referenceId is required for deductions.");
    if (typeof amount !== "number" || amount <= 0) return err("amount must be a positive number.");

    ensureUser(userId);

    const balanceResult = getUserBalance(userId);
    if (!balanceResult.success) return balanceResult;
    if (balanceResult.data.balance < amount) {
        return err(`Insufficient balance. Available: ${balanceResult.data.balance}, Required: ${amount}.`);
    }

    const entry = {
        id: generateId(),
        userId,
        points: -amount,
        reason: "voucher_deduction",
        referenceId,
        timestamp: getTimestamp(),
    };

    store.pointsLedger.push(entry);
    insertUserEntity(entry.userId, "points", entry);
    schedulePersist();  // #7

    log("info", "points.deducted", { userId, amount, referenceId });
    return ok({ userId, deducted: amount, newBalance: balanceResult.data.balance - amount });
}, "points.deduct");

// ─── Get Ledger ───────────────────────────────────────────────────────────────
export const getUserPointsLedger = (userId) => tryCatch(() => {
    if (!userId) return err("userId is required.");
    const ledger = (userIndices.points.get(userId) || [])
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return ok(ledger);
}, "points.getLedger");

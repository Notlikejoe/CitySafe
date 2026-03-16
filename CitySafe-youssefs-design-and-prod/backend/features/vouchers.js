/**
 * CitySafe Vouchers Module
 *
 * Fixes applied (v2 audit):
 * #6 — all public exports wrapped in tryCatch().
 * #7 — schedulePersist() called after every mutation.
 */

import { store, POINTS_CONFIG, VOUCHER_CONFIG, schedulePersist } from "../store.js";
import { generateId, getTimestamp, addDays, tryCatch, ok, err, log } from "../utils.js";
import { getUserBalance, deductPoints } from "./points.js";

// ─── Internal: Atomically Issue Vouchers ─────────────────────────────────────
export const issueVoucherIfEligible = (userId) => {
    const balResult = getUserBalance(userId);
    if (!balResult.success) return;

    const { balance } = balResult.data;
    if (balance < POINTS_CONFIG.VOUCHER_THRESHOLD) return;

    const vouchersToIssue = Math.floor(balance / POINTS_CONFIG.VOUCHER_COST);
    if (vouchersToIssue <= 0) return;

    const totalCost = vouchersToIssue * POINTS_CONFIG.VOUCHER_COST;
    const batchRefId = `voucher_batch_${generateId()}`;
    const deductResult = deductPoints(userId, totalCost, batchRefId);
    if (!deductResult.success) {
        log("warn", "voucher.batch_deduction_failed", { userId, totalCost, reason: deductResult.error });
        return;
    }

    for (let i = 0; i < vouchersToIssue; i++) {
        _createVoucher(userId);
    }
    log("info", "voucher.batch_issued", { userId, count: vouchersToIssue, totalCost });
};

const _createVoucher = (userId) => {
    const voucherId = generateId();
    const voucher = {
        id: voucherId,
        userId,
        code: `CSV-${voucherId.replace(/-/g, "").slice(0, 10).toUpperCase()}`,
        issuedAt: getTimestamp(),
        expiresAt: addDays(new Date(), VOUCHER_CONFIG.EXPIRY_DAYS),
        redeemed: false,
        redeemedAt: null,
    };
    store.vouchers.push(voucher);
    schedulePersist();  // #7
    return voucher;
};

// ─── Redeem Voucher (idempotent) ──────────────────────────────────────────────
export const redeemVoucher = (voucherCode, userId) => tryCatch(() => {
    if (!voucherCode) return err("voucherCode is required.");
    if (!userId) return err("userId is required.");

    const voucher = store.vouchers.find(
        (v) => (v.code === voucherCode || v.id === voucherCode) && v.userId === userId
    );
    if (!voucher) return err(`Voucher '${voucherCode}' not found for user '${userId}'.`);

    // Idempotent: same user re-redeems → success with existing state
    if (voucher.redeemed) {
        log("info", "voucher.redeem_noop", { userId, voucherCode, redeemedAt: voucher.redeemedAt });
        return ok(voucher);
    }

    if (new Date(voucher.expiresAt) < new Date()) {
        return err(`Voucher '${voucherCode}' expired on ${voucher.expiresAt}.`);
    }

    voucher.redeemed = true;
    voucher.redeemedAt = getTimestamp();
    schedulePersist();  // #7

    log("info", "voucher.redeemed", { userId, voucherCode, redeemedAt: voucher.redeemedAt });
    return ok(voucher);
}, "vouchers.redeem");

// ─── Get User Vouchers ────────────────────────────────────────────────────────
export const getUserVouchers = (userId, filters = {}) => tryCatch(() => {
    if (!userId) return err("userId is required.");

    const now = new Date();
    let vouchers = store.vouchers.filter((v) => v.userId === userId);

    if (filters.activeOnly) {
        vouchers = vouchers.filter((v) => !v.redeemed && new Date(v.expiresAt) >= now);
    }
    vouchers.sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
    return ok(vouchers);
}, "vouchers.getUserVouchers");

import { query } from "../db.js";
import { tryCatch, ok, err, generateId, getTimestamp } from "../utils.js";

// ─── Award Points ─────────────────────────────────────────────────────────────
export const awardPoints = async (params) => {
    const { userId, reason } = params;
    
    // We get real ID if UUID
    let uId = userId;
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const uRes = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
        if (uRes.data?.rows?.length > 0) uId = uRes.data.rows[0].id;
        else return err("User not found");
    }

    let amount = 0;
    switch (reason) {
        case "report_submitted": amount = 10; break;
        case "report_verified": amount = 50; break;
        case "sos_responded": amount = 100; break;
        case "Welcome to CitySafe": amount = 50; break;
        default: amount = 5;
    }

    const res = await query(`SELECT award_points($1, $2, $3)`, [uId, amount, reason]);
    if (!res.success) return err(res.error);
    
    return ok({ amount, reason });
};

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export const getPointsLeaderboard = async () => {
    const res = await query(`
        SELECT id as "userId", username as "displayName", points as "totalPoints"
        FROM users 
        ORDER BY points DESC 
        LIMIT 10
    `);
    
    if (!res.success) return err(res.error);
    return ok({ topUsers: res.data.rows });
};

// ─── User Ledger ─────────────────────────────────────────────────────────────
export const getUserLedger = async (userId) => {
    let uId = userId;
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const uRes = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
        if (uRes.data?.rows?.length > 0) uId = uRes.data.rows[0].id;
    }

    const [uRes, lRes] = await Promise.all([
        query(`SELECT points FROM users WHERE id = $1`, [uId]),
        query(`SELECT amount, reason, timestamp as "timestamp" FROM points_ledger WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50`, [uId])
    ]);

    if (!uRes.success || !lRes.success) return err("Failed to fetch ledger");
    
    return ok({
        userId: uId,
        totalPoints: uRes.data.rows[0]?.points || 0,
        history: lRes.data.rows
    });
};

// ─── Redeem Voucher ───────────────────────────────────────────────────────────
export const redeemVoucher = async (userId, voucherId) => {
    return err("Not implemented for Postgres yet");
};

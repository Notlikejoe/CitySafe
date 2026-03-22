import { query } from "../db.js";
import { tryCatch, ok, err } from "../utils.js";

// ─── Get Vouchers ─────────────────────────────────────────────────────────────
export const getVouchers = async () => {
    const res = await query(`SELECT id, code, sponsor, description, cost, available FROM vouchers ORDER BY cost ASC`);
    if (!res.success) return err(res.error);
    return ok(res.data.rows);
};

// ─── Redeem Voucher ───────────────────────────────────────────────────────────
export const redeemVoucher = async (userId, voucherId) => {
    let uId = userId;
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const uRes = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
        if (uRes.data?.rows?.length > 0) uId = uRes.data.rows[0].id;
        else return err("User not found");
    }

    const vRes = await query(`SELECT cost, available FROM vouchers WHERE id = $1`, [voucherId]);
    if (!vRes.success || vRes.data.rows.length === 0) return err("Voucher not found");
    if (!vRes.data.rows[0].available) return err("Voucher is sold out");

    const cost = vRes.data.rows[0].cost;

    // Check user points
    const pRes = await query(`SELECT points FROM users WHERE id = $1`, [uId]);
    if (!pRes.success || pRes.data.rows.length === 0) return err("User not found");
    
    if (pRes.data.rows[0].points < cost) return err("Insufficient points");

    // Execute redemption
    const redeemStr = `
        WITH deduction AS (
            UPDATE users SET points = points - $2 WHERE id = $1 RETURNING id
        ),
        ledger_insert AS (
            INSERT INTO points_ledger (user_id, amount, reason) VALUES ($1, -$2, 'Voucher Redemption')
        )
        INSERT INTO user_vouchers (user_id, voucher_id) VALUES ($1, $3) RETURNING id
    `;
    
    const rRes = await query(redeemStr, [uId, cost, voucherId]);
    if (!rRes.success) return err(rRes.error);
    
    return ok({ voucherId, cost });
};

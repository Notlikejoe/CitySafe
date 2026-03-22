import { query } from "../db.js";
import { ok, err } from "../utils.js";

const VALID_TYPES = ["report", "sos", "point", "voucher"];

export const getUserHistory = async (userId, options = {}) => {
    const { type, page = 1 } = options;
    const limit = 50;
    const offset = (page - 1) * limit;

    if (!userId) return err("userId is required.");
    if (type && !VALID_TYPES.includes(type)) {
        return err(`Invalid type filter '${type}'`);
    }

    let uId = userId;
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const uRes = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
        if (uRes.data?.rows?.length > 0) uId = uRes.data.rows[0].id;
        else return err("User not found");
    }

    // For a unified history, we UNION ALL the relevant tables
    // We return a generic structure: id, _type, _timestamp, and a JSON payload for specific data
    let parts = [];

    if (!type || type === "report") {
        parts.push(`
            SELECT id::text, 'report' as _type, created_at as _timestamp, 
                   json_build_object('type', type, 'description', description, 'status', status) as data
            FROM reports WHERE author_id = $1
        `);
    }
    if (!type || type === "sos") {
        parts.push(`
            SELECT id::text, 'sos' as _type, created_at as _timestamp, 
                   json_build_object('type', type, 'urgency', urgency, 'status', status) as data
            FROM sos_requests WHERE requester_id = $1
        `);
    }
    if (!type || type === "point") {
        parts.push(`
            SELECT id::text, 'point' as _type, timestamp as _timestamp, 
                   json_build_object('amount', amount, 'reason', reason) as data
            FROM points_ledger WHERE user_id = $1
        `);
    }
    if (!type || type === "voucher") {
        parts.push(`
            SELECT uv.id::text, 'voucher' as _type, uv.redeemed_at as _timestamp, 
                   json_build_object('code', v.code, 'sponsor', v.sponsor) as data
            FROM user_vouchers uv
            JOIN vouchers v ON uv.voucher_id = v.id
            WHERE uv.user_id = $1
        `);
    }

    if (parts.length === 0) return ok({ items: [], page, pageSize: limit, summary: {} });

    const sql = `
        WITH combined AS (
            ${parts.join("\nUNION ALL\n")}
        )
        SELECT * FROM combined
        ORDER BY _timestamp DESC
        LIMIT $2 OFFSET $3
    `;

    const res = await query(sql, [uId, limit, offset]);
    if (!res.success) return err(res.error);

    const items = res.data.rows.map(r => ({
        id: r.id,
        _type: r._type,
        _timestamp: r._timestamp,
        ...r.data
    }));

    // Fetch summary stats
    const statsStr = `
        SELECT 
            (SELECT COUNT(*) FROM reports WHERE author_id = $1) as reports,
            (SELECT COUNT(*) FROM sos_requests WHERE requester_id = $1) as sos,
            (SELECT points FROM users WHERE id = $1) as points,
            (SELECT COUNT(*) FROM user_vouchers WHERE user_id = $1) as vouchers
    `;
    const statsRes = await query(statsStr, [uId]);
    const summary = statsRes.success && statsRes.data.rows.length > 0 ? {
        totalReports: parseInt(statsRes.data.rows[0].reports),
        totalSos: parseInt(statsRes.data.rows[0].sos),
        pointBalance: parseInt(statsRes.data.rows[0].points),
        activeVouchers: parseInt(statsRes.data.rows[0].vouchers)
    } : {};

    return ok({ items, page, pageSize: limit, summary });
};

import { query } from "../db.js";
import { tryCatch, ok, err, log, generateId } from "../utils.js";

// ─── Create SOS ───────────────────────────────────────────────────────────────
export const createSosRequest = async (userId, payload) => {
    const { type, urgency, location, description } = payload;
    if (!type || !urgency || !location?.lat || !location?.lon) {
        return err("Type, urgency, lat, and lon are required.");
    }
    
    const sql = `
        INSERT INTO sos_requests (requester_id, type, urgency, description, location)
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))
        RETURNING id, requester_id as "requesterId", type, urgency, description, status, created_at as "createdAt", 
                  ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat;
    `;
    
    let reqId = userId;
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const uRes = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
        if (uRes.data?.rows?.length > 0) reqId = uRes.data.rows[0].id;
    }

    const res = await query(sql, [reqId, type, urgency, description, location.lon, location.lat]);
    if (!res.success) return err(res.error);
    
    const row = res.data.rows[0];
    const sos = {
        ...row,
        location: { lat: row.lat, lon: row.lon }
    };

    log("info", "sos.created", { sosId: sos.id, userId, type, urgency });
    return ok(sos);
};

// ─── Transition Status ────────────────────────────────────────────────────────
export const updateSosStatus = async (sosId, newStatus) => {
    const valid = ["pending", "under_review", "resolved", "cancelled"];
    if (!valid.includes(newStatus)) return err("Invalid status");
    
    const res = await query(
        `UPDATE sos_requests SET status = $1 WHERE id = $2 RETURNING id, status`,
        [newStatus, sosId]
    );
    
    if (!res.success) return err(res.error);
    if (res.data.rowCount === 0) return err("SOS request not found", 404);
    
    return ok(res.data.rows[0]);
};

// ─── Get Active SOS ───────────────────────────────────────────────────────────
export const getActiveSosRequests = async (lat, lon, radiusKm = 10, page = 1) => {
    const radiusMeters = radiusKm * 1000;
    
    const sql = `
        SELECT id, requester_id as "requesterId", type, urgency, description, status, created_at as "createdAt",
               ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat,
               ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_m
        FROM sos_requests
        WHERE status IN ('pending', 'under_review')
          AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        ORDER BY 
            CASE urgency WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            created_at DESC
        LIMIT $4 OFFSET $5
    `;
    
    const res = await query(sql, [lon, lat, radiusMeters, 50, (page - 1) * 50]);
    if (!res.success) return err(res.error);
    
    const items = res.data.rows.map(r => ({
        ...r,
        location: { lat: r.lat, lon: r.lon }
    }));
    
    return ok({ items, page, pageSize: 50 });
};

// ─── Get SOS By User ──────────────────────────────────────────────────────────
export const getSosRequestsByUser = async (userId, page = 1) => {
    let reqId = userId;
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const uRes = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
        if (uRes.data?.rows?.length > 0) reqId = uRes.data.rows[0].id;
    }
    
    const sql = `
        SELECT id, requester_id as "requesterId", type, urgency, description, status, created_at as "createdAt",
               ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat
        FROM sos_requests
        WHERE requester_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `;
    
    const res = await query(sql, [reqId, 50, (page - 1) * 50]);
    if (!res.success) return err(res.error);
    
    const items = res.data.rows.map(r => ({
        ...r,
        location: { lat: r.lat, lon: r.lon }
    }));
    
    return ok({ items, page, pageSize: 50, totalPages: Math.ceil(items.length / 50) });
};

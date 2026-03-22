import { query } from "../db.js";
import { ok, err, log } from "../utils.js";

// ─── Create Alert ─────────────────────────────────────────────────────────────
export const createAlert = async (userId, payload) => {
    const { type, priority, message, location, radiusKm } = payload;
    if (!type || !priority || !message || !location?.lat || !location?.lon) {
        return err("Type, priority, message, lat, and lon are required.");
    }
    
    const sql = `
        INSERT INTO alerts (issuer_id, type, priority, message, location, radius_km, expires_at)
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, NOW() + INTERVAL '24 HOURS')
        RETURNING id, issuer_id as "issuerId", type, priority, message, active, created_at as "createdAt", 
                  expires_at as "expiresAt", radius_km as "radiusKm",
                  ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat;
    `;
    
    let issuer = userId;
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const uRes = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
        if (uRes.data?.rows?.length > 0) issuer = uRes.data.rows[0].id;
    }

    const res = await query(sql, [issuer, type, priority, message, location.lon, location.lat, radiusKm || 10]);
    if (!res.success) return err(res.error);
    
    const row = res.data.rows[0];
    const alert = {
        ...row,
        location: { lat: row.lat, lon: row.lon }
    };

    log("info", "alert.created", { alertId: alert.id, type, priority });
    return ok(alert);
};

// ─── Get Active Alerts ────────────────────────────────────────────────────────
export const getActiveAlerts = async (lat, lon, radiusKm = 20) => {
    const radiusMeters = radiusKm * 1000;
    
    // We only want alerts that are marked 'active' AND haven't expired
    // We check distance relative to their own radius_km
    const sql = `
        SELECT id, issuer_id as "issuerId", type, priority, message, active, created_at as "createdAt", 
               expires_at as "expiresAt", radius_km as "radiusKm",
               ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat,
               ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_m
        FROM alerts
        WHERE active = true 
          AND expires_at > NOW()
          AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        ORDER BY 
            CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
            created_at DESC
        LIMIT 50
    `;
    
    const res = await query(sql, [lon, lat, radiusMeters]);
    if (!res.success) return err(res.error);
    
    const items = res.data.rows.map(r => ({
        ...r,
        location: { lat: r.lat, lon: r.lon }
    }));
    
    return ok(items);
};

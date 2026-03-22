import { query } from "../db.js";
import { ok, err } from "../utils.js";

/**
 * Searches across reports, sos requests, and alerts using a unified PostgreSQL query
 * leveraging UNION ALL and ILIKE for keyword matching. PostGIS is optionally used
 * if a geolocation is provided.
 */
export const searchContent = async (params) => {
    const { q, page = 1, lat, lon, radius = 10, type } = params;
    const limit = 50;
    const offset = (page - 1) * limit;

    const queryStr = `%${(q || "").toLowerCase()}%`;
    const noGeo = !lat || !lon;
    const radiusMeters = Number(radius) * 1000;

    let sql = `
        WITH combined AS (
            SELECT 
                r.id, 'report' as document_type, r.type, r.description, r.status, r.created_at, 
                ST_X(r.location::geometry) as lon, ST_Y(r.location::geometry) as lat
                ${noGeo ? ", 0 as distance_m" : `, ST_Distance(r.location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) as distance_m`}
            FROM reports r
            WHERE ($1 = '%%' OR r.description ILIKE $1 OR r.type ILIKE $1)
            ${noGeo ? "" : `AND ST_DWithin(r.location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)`}

            UNION ALL

            SELECT 
                s.id, 'sos' as document_type, s.type, s.description, s.status, s.created_at, 
                ST_X(s.location::geometry) as lon, ST_Y(s.location::geometry) as lat
                ${noGeo ? ", 0 as distance_m" : `, ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) as distance_m`}
            FROM sos_requests s
            WHERE ($1 = '%%' OR s.description ILIKE $1 OR s.type ILIKE $1)
            ${noGeo ? "" : `AND ST_DWithin(s.location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)`}

            UNION ALL

            SELECT 
                a.id, 'alert' as document_type, a.type, a.message as description, CASE WHEN a.active THEN 'active' ELSE 'inactive' END as status, a.created_at, 
                ST_X(a.location::geometry) as lon, ST_Y(a.location::geometry) as lat
                ${noGeo ? ", 0 as distance_m" : `, ST_Distance(a.location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) as distance_m`}
            FROM alerts a
            WHERE ($1 = '%%' OR a.message ILIKE $1 OR a.type ILIKE $1)
            ${noGeo ? "" : `AND ST_DWithin(a.location::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)`}
        )
        SELECT * FROM combined
        ORDER BY created_at DESC
        LIMIT $${noGeo ? 2 : 5} OFFSET $${noGeo ? 3 : 6}
    `;

    const args = noGeo 
        ? [queryStr, limit, offset] 
        : [queryStr, Number(lon), Number(lat), radiusMeters, limit, offset];

    const res = await query(sql, args);
    if (!res.success) return err(res.error);

    const items = res.data.rows.map(row => ({
        id: row.id,
        documentType: row.document_type,
        type: row.type,
        description: row.description,
        status: row.status,
        createdAt: row.created_at,
        location: { lat: row.lat, lon: row.lon },
        distance: noGeo ? null : row.distance_m
    }));

    return ok({ items, page: Number(page), pageSize: limit });
};

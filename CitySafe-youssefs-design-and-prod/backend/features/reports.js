import { query } from "../db.js";
import { tryCatch, ok, err, log, generateId, isValidLocation } from "../utils.js";
import { awardPoints } from "./points.js";

const normalizeImageUrl = (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();

    // Only persist actual URLs or backend upload paths. This avoids leaking
    // old free-text "image" values into <img src>, which produced broken output.
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("/uploads/")) return trimmed;
    return null;
};

// ─── Create Report ────────────────────────────────────────────────────────────
export const createReport = async (userId, payload) => {
    const { type, description, location, imageRef, imageUrl } = payload;
    const normalizedDescription = String(description ?? "").trim();

    // Normalize coordinates to floats once so storage and map rendering stay consistent.
    const normalizedLocation = {
        lat: Number(location?.lat),
        lon: Number(location?.lon),
    };

    if (!type) {
        return err("Type is required.");
    }
    // Mirror the frontend rule at the API boundary so blank reports cannot be created directly.
    if (normalizedDescription.length <= 2) {
        return err("Description must be at least 3 characters long.");
    }
    if (!isValidLocation(normalizedLocation)) {
        return err("Valid latitude and longitude are required.");
    }
    
    const sql = `
        INSERT INTO reports (author_id, type, description, image_ref, image_url, location)
        VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326))
        RETURNING id, author_id, type, description, image_ref, image_url, status, created_at,
                  ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat;
    `;
    
    let authorId = userId;
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // Find or create dummy user by username
        const uRes = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
        if (uRes.data?.rows?.length > 0) {
            authorId = uRes.data.rows[0].id;
        } else {
            const newU = await query(`INSERT INTO users (username, password_hash) VALUES ($1, 'dummy') RETURNING id`, [userId]);
            if (newU.success) authorId = newU.data.rows[0].id;
        }
    }

    const normalizedImageUrl = normalizeImageUrl(imageUrl ?? imageRef ?? null);
    const res = await query(sql, [
        authorId,
        type,
        normalizedDescription,
        normalizedImageUrl,
        normalizedImageUrl,
        normalizedLocation.lon,
        normalizedLocation.lat,
    ]);
    if (!res.success) return err(res.error);
    
    const row = res.data.rows[0];
    const report = {
        id: row.id,
        authorId: row.author_id,
        type: row.type,
        description: row.description,
        imageRef: normalizeImageUrl(row.image_ref),
        imageUrl: normalizeImageUrl(row.image_url ?? row.image_ref ?? null),
        status: row.status,
        createdAt: row.created_at,
        location: { lat: row.lat, lon: row.lon }
    };

    log("info", "report.created", { reportId: report.id, userId, type, location });

    // Instantly award 10 submission points
    awardPoints({ userId: report.authorId, reason: "report_submitted", referenceId: report.id });

    return ok(report);
};

// ─── Transition Status ────────────────────────────────────────────────────────
export const transitionReportStatus = async (reportId, newStatus) => {
    const valid = ["under_review", "verified", "resolved", "rejected", "cancelled"];
    if (!valid.includes(newStatus)) return err("Invalid status");
    
    const res = await query(
        `UPDATE reports SET status = $1 WHERE id = $2 RETURNING id, status`,
        [newStatus, reportId]
    );
    
    if (!res.success) return err(res.error);
    if (res.data.rowCount === 0) return err("Report not found", 404);
    
    return ok(res.data.rows[0]);
};

export const adminVerifyReport = (reportId) => transitionReportStatus(reportId, "verified");
export const adminRejectReport = (reportId) => transitionReportStatus(reportId, "rejected");
export const cancelReport = (reportId) => transitionReportStatus(reportId, "cancelled");

// ─── Get Nearby Reports ───────────────────────────────────────────────────────
export const getNearbyReports = async (lat, lon, radiusKm = 5, page = 1) => {
    const radiusMeters = radiusKm * 1000;
    
    const sql = `
        SELECT id, author_id as "authorId", type, description,
               image_ref as "imageRef", COALESCE(image_url, image_ref) as "imageUrl",
               status, created_at as "createdAt",
               ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat,
               ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_m
        FROM reports
        WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
        ORDER BY created_at DESC
        LIMIT $4 OFFSET $5
    `;
    
    const res = await query(sql, [lon, lat, radiusMeters, 50, (page - 1) * 50]);
    if (!res.success) return err(res.error);
    
    const items = res.data.rows.map(r => ({
        ...r,
        imageRef: normalizeImageUrl(r.imageRef),
        imageUrl: normalizeImageUrl(r.imageUrl),
        location: { lat: r.lat, lon: r.lon }
    }));
    
    return ok({ items, page, pageSize: 50 });
};

// ─── Get Reports By User ──────────────────────────────────────────────────────
export const getReportsByUser = async (userId, page = 1) => {
    let authorId = userId;
    if (!userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const uRes = await query(`SELECT id FROM users WHERE username = $1`, [userId]);
        if (uRes.data?.rows?.length > 0) authorId = uRes.data.rows[0].id;
    }
    
    const sql = `
        SELECT id, author_id as "authorId", type, description,
               image_ref as "imageRef", COALESCE(image_url, image_ref) as "imageUrl",
               status, created_at as "createdAt",
               ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat
        FROM reports
        WHERE author_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `;
    
    const res = await query(sql, [authorId, 50, (page - 1) * 50]);
    if (!res.success) return err(res.error);
    
    const items = res.data.rows.map(r => ({
        ...r,
        imageRef: normalizeImageUrl(r.imageRef),
        imageUrl: normalizeImageUrl(r.imageUrl),
        location: { lat: r.lat, lon: r.lon }
    }));
    
    return ok({ items, page, pageSize: 50, totalPages: Math.ceil(items.length / 50) });
};

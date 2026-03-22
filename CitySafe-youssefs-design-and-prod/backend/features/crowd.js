/**
 * CitySafe Crowd Density Feature
 *
 * Calculates real-time crowd density by aggregating recent report activity
 * into a spatial grid. Each grid cell covers approximately 0.01° × 0.01°
 * (~1.1 km × 1.1 km). Cells with high recent activity are classified as
 * "High" density, moderate as "Medium", and quiet cells as "Low".
 *
 * This replaces the static CROWD_ZONES mock data in MapPage.jsx.
 */

import { query } from "../db.js";
import { tryCatch, ok } from "../utils.js";

// Map density levels to visual colours matching the frontend legend
const LEVEL_COLOR = {
    High:   "#ef4444",
    Medium: "#f97316",
    Low:    "#22c55e",
};

const LEVEL_NOTE = {
    High:   "High activity — elevated report density in this area",
    Medium: "Moderate activity — some recent reports nearby",
    Low:    "Low activity — quiet area with few recent reports",
};

// Consider reports filed within the last 2 hours
const WINDOW_STR = "2 hours";

// Grid cell size in degrees (~1.11 km at the equator)
const CELL_DEG = 0.01;

/**
 * Returns crowd density zones derived from recent report density.
 * Each zone is a circle centred on a grid-cell centroid.
 *
 * @returns {Promise<{ id, center: [lat, lon], radius, level, color, note }[]>}
 */
export const getCrowdZones = async () => tryCatch(async () => {
    // Fetch recent reports from PostgreSQL
    const res = await query(`
        SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lon 
        FROM reports 
        WHERE created_at >= NOW() - INTERVAL '2 hours'
        AND location IS NOT NULL
    `);

    if (!res.success) return ok([]);

    // Bucket recent reports into grid cells
    const cellCounts = new Map(); // "cLat:cLon" → count
    const cellCentroids = new Map(); // "cLat:cLon" → { lat, lon, sumLat, sumLon, count }

    for (const report of res.data.rows) {
        const lat = parseFloat(report.lat);
        const lon = parseFloat(report.lon);
        const cLat = Math.floor(lat / CELL_DEG);
        const cLon = Math.floor(lon / CELL_DEG);
        const key = `${cLat}:${cLon}`;

        cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);

        if (!cellCentroids.has(key)) {
            cellCentroids.set(key, { sumLat: 0, sumLon: 0, count: 0 });
        }
        const c = cellCentroids.get(key);
        c.sumLat += lat;
        c.sumLon += lon;
        c.count += 1;
    }

    // Sort by count descending to only surface the most active zones
    const sorted = [...cellCounts.entries()].sort((a, b) => b[1] - a[1]);

    const zones = sorted.map(([key, count], idx) => {
        const c = cellCentroids.get(key);
        const centerLat = c.sumLat / c.count;
        const centerLon = c.sumLon / c.count;

        // Classify density level
        let level;
        if (count >= 5) level = "High";
        else if (count >= 2) level = "Medium";
        else level = "Low";

        // Scale radius with activity (base 150 m, up to 500 m)
        const radius = Math.min(150 + count * 30, 500);

        return {
            id: `crowd_${key}_${idx}`,
            center: [centerLat, centerLon],
            radius,
            level,
            color: LEVEL_COLOR[level],
            note: LEVEL_NOTE[level],
            count,
        };
    });

    return ok(zones);
}, "crowd.getZones");

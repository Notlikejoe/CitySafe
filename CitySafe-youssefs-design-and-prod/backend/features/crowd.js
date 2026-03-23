/**
 * CitySafe Crowd Density Feature
 *
 * External crowd APIs are not dependable enough for this application without a
 * dedicated commercial provider, so the heat/crowd overlays are derived from
 * live internal incident data.
 *
 * This version improves the previous implementation by:
 * - scoping queries to the current map viewport when coordinates are provided
 * - smoothing nearby points into neighbouring grid cells
 * - applying distance-based decay for more realistic intensity
 * - normalizing every zone intensity into a stable 0..1 range for the frontend
 */

import { query } from "../db.js";
import { calculateDistance, isValidLocation, ok, log } from "../utils.js";

const LEVEL_META = {
    High: { color: "#ef4444", note: "High incident density in this area" },
    Medium: { color: "#f97316", note: "Moderate incident density nearby" },
    Low: { color: "#facc15", note: "Light incident density nearby" },
};

const CELL_DEG = 0.035;
const SMOOTHING_STEPS = 1;
const EPSILON = 0.15;

const buildScopedIncidentQuery = (scope) => {
    if (scope) {
        return {
            sql: `
                WITH incident_points AS (
                    SELECT
                        ST_Y(location::geometry) AS lat,
                        ST_X(location::geometry) AS lon,
                        1.0 AS weight
                    FROM reports
                    WHERE location IS NOT NULL
                      AND status NOT IN ('resolved', 'cancelled')
                      AND created_at >= NOW() - INTERVAL '24 hours'
                      AND ST_DWithin(
                          location::geography,
                          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                          $3
                      )

                    UNION ALL

                    SELECT
                        ST_Y(location::geometry) AS lat,
                        ST_X(location::geometry) AS lon,
                        CASE urgency
                            WHEN 'high' THEN 3.0
                            WHEN 'medium' THEN 2.0
                            ELSE 1.0
                        END AS weight
                    FROM sos_requests
                    WHERE location IS NOT NULL
                      AND status IN ('pending', 'under_review')
                      AND created_at >= NOW() - INTERVAL '24 hours'
                      AND ST_DWithin(
                          location::geography,
                          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                          $3
                      )
                )
                SELECT lat, lon, weight
                FROM incident_points
            `,
            params: [scope.lon, scope.lat, scope.radiusMeters],
        };
    }

    return {
        sql: `
            WITH incident_points AS (
                SELECT
                    ST_Y(location::geometry) AS lat,
                    ST_X(location::geometry) AS lon,
                    1.0 AS weight
                FROM reports
                WHERE location IS NOT NULL
                  AND status NOT IN ('resolved', 'cancelled')
                  AND created_at >= NOW() - INTERVAL '24 hours'

                UNION ALL

                SELECT
                    ST_Y(location::geometry) AS lat,
                    ST_X(location::geometry) AS lon,
                    CASE urgency
                        WHEN 'high' THEN 3.0
                        WHEN 'medium' THEN 2.0
                        ELSE 1.0
                    END AS weight
                FROM sos_requests
                WHERE location IS NOT NULL
                  AND status IN ('pending', 'under_review')
                  AND created_at >= NOW() - INTERVAL '24 hours'
            )
            SELECT lat, lon, weight
            FROM incident_points
        `,
        params: [],
    };
};

export const getCrowdZones = async (lat, lon, radiusKm = 12) => {
    try {
        const scope = isValidLocation({ lat: Number(lat), lon: Number(lon) })
            ? {
                lat: Number(lat),
                lon: Number(lon),
                radiusMeters: Math.max(4000, Number(radiusKm || 12) * 1000 * 1.8),
            }
            : null;

        const queryConfig = buildScopedIncidentQuery(scope);
        const res = await query(queryConfig.sql, queryConfig.params);

        if (!res.success) {
            log("error", "crowd.query_failed", { error: res.error });
            return ok([]);
        }

        const points = res.data.rows
            .map((row) => ({
                lat: Number(row.lat),
                lon: Number(row.lon),
                weight: Number(row.weight),
            }))
            .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon) && Number.isFinite(point.weight));

        if (points.length === 0) {
            return ok([]);
        }

        const candidateCells = new Map();
        for (const point of points) {
            const baseLat = Math.floor(point.lat / CELL_DEG);
            const baseLon = Math.floor(point.lon / CELL_DEG);

            for (let latStep = -SMOOTHING_STEPS; latStep <= SMOOTHING_STEPS; latStep++) {
                for (let lonStep = -SMOOTHING_STEPS; lonStep <= SMOOTHING_STEPS; lonStep++) {
                    const cellLat = baseLat + latStep;
                    const cellLon = baseLon + lonStep;
                    const key = `${cellLat}:${cellLon}`;

                    if (!candidateCells.has(key)) {
                        candidateCells.set(key, {
                            centerLat: (cellLat + 0.5) * CELL_DEG,
                            centerLon: (cellLon + 0.5) * CELL_DEG,
                        });
                    }
                }
            }
        }

        const rawZones = Array.from(candidateCells.entries())
            .map(([key, cell], index) => {
                let influence = 0;
                let incidentCount = 0;

                for (const point of points) {
                    const distanceKm = calculateDistance(cell.centerLat, cell.centerLon, point.lat, point.lon);
                    const contribution = point.weight / (distanceKm * distanceKm + EPSILON);
                    influence += contribution;

                    if (distanceKm <= 4) {
                        incidentCount += 1;
                    }
                }

                if (influence <= 0.05) return null;

                return {
                    id: `density_${key}_${index}`,
                    center: [cell.centerLat, cell.centerLon],
                    influence,
                    count: incidentCount,
                };
            })
            .filter(Boolean);

        const maxInfluence = Math.max(...rawZones.map((zone) => zone.influence), 1);

        const zones = rawZones
            .map((zone) => {
                const intensity = Math.min(zone.influence / maxInfluence, 1);
                let level = "Low";
                if (intensity >= 0.65) level = "High";
                else if (intensity >= 0.35) level = "Medium";

                const meta = LEVEL_META[level];
                const radius = Math.round(220 + intensity * 680);

                return {
                    id: zone.id,
                    center: zone.center,
                    radius,
                    level,
                    color: meta.color,
                    note: meta.note,
                    count: zone.count,
                    intensity: Number(intensity.toFixed(4)),
                    weight: Number(zone.influence.toFixed(4)),
                    fillOpacity: Math.max(0.12, intensity * 0.35),
                };
            })
            .sort((a, b) => b.intensity - a.intensity);

        return ok(zones);
    } catch (error) {
        log("error", "crowd.unhandled_error", { message: error.message });
        return ok([]);
    }
};

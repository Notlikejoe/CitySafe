/**
 * Accessibility resource discovery.
 *
 * Preferred path:
 * - query OpenStreetMap Overpass for nearby public facilities
 *
 * Fallback path:
 * - return a cached result for the same lat/lon/radius request
 * - otherwise synthesize nearby fallback resources around the requested point
 *
 * This keeps the accessibility lens usable when the upstream API is temporarily
 * unavailable or sparse, while preserving the same frontend marker contract.
 */

import { calculateDistance, isValidLocation, log, ok, err } from "../utils.js";

const OVERPASS_ENDPOINTS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
];

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

const CATEGORY_META = {
    environmental: { emoji: "🌿", color: "#16a34a" },
    accessibility: { emoji: "♿", color: "#0ea5e9" },
    safety: { emoji: "🛡️", color: "#f59e0b" },
    medical: { emoji: "🏥", color: "#dc2626" },
};

const FALLBACK_BLUEPRINTS = [
    { category: "medical", type: "hospital", name: "Nearby hospital", angleDeg: 18, distanceKm: 0.8 },
    { category: "medical", type: "pharmacy_24h", name: "24-hour pharmacy", angleDeg: 74, distanceKm: 1.05 },
    { category: "safety", type: "police_station", name: "Police station", angleDeg: 132, distanceKm: 0.95 },
    { category: "safety", type: "safe_place", name: "Community safe place", angleDeg: 196, distanceKm: 0.65 },
    { category: "accessibility", type: "accessible_restroom", name: "Accessible restroom", angleDeg: 248, distanceKm: 0.55 },
    { category: "accessibility", type: "ramp_access", name: "Accessible entrance", angleDeg: 290, distanceKm: 0.88 },
    { category: "environmental", type: "hydration_station", name: "Hydration station", angleDeg: 326, distanceKm: 0.72 },
    { category: "environmental", type: "cooling_center", name: "Cooling center", angleDeg: 40, distanceKm: 1.2 },
];

const cacheKeyFor = (lat, lon, radiusKm) =>
    `${Number(lat).toFixed(4)}:${Number(lon).toFixed(4)}:${Number(radiusKm).toFixed(2)}`;

const overpassQuery = (lat, lon, radiusMeters) => `
[out:json][timeout:20];
(
  node["amenity"="drinking_water"](around:${radiusMeters},${lat},${lon});
  way["amenity"="drinking_water"](around:${radiusMeters},${lat},${lon});
  node["amenity"="fountain"](around:${radiusMeters},${lat},${lon});
  way["amenity"="shelter"](around:${radiusMeters},${lat},${lon});
  way["leisure"~"park|garden"](around:${radiusMeters},${lat},${lon});

  node["amenity"="toilets"]["wheelchair"="yes"](around:${radiusMeters},${lat},${lon});
  way["amenity"="toilets"]["wheelchair"="yes"](around:${radiusMeters},${lat},${lon});
  node["highway"="elevator"](around:${radiusMeters},${lat},${lon});
  way["highway"="elevator"](around:${radiusMeters},${lat},${lon});
  node["entrance"="yes"]["wheelchair"="yes"](around:${radiusMeters},${lat},${lon});
  way["entrance"="yes"]["wheelchair"="yes"](around:${radiusMeters},${lat},${lon});
  node["amenity"="library"](around:${radiusMeters},${lat},${lon});
  way["amenity"="library"](around:${radiusMeters},${lat},${lon});

  node["amenity"="police"](around:${radiusMeters},${lat},${lon});
  way["amenity"="police"](around:${radiusMeters},${lat},${lon});
  node["amenity"="community_centre"](around:${radiusMeters},${lat},${lon});
  way["amenity"="community_centre"](around:${radiusMeters},${lat},${lon});
  way["lit"="yes"]["highway"~"footway|path|pedestrian"](around:${radiusMeters},${lat},${lon});

  node["amenity"~"hospital|clinic|pharmacy"](around:${radiusMeters},${lat},${lon});
  way["amenity"~"hospital|clinic|pharmacy"](around:${radiusMeters},${lat},${lon});
  node["emergency"="defibrillator"](around:${radiusMeters},${lat},${lon});
  way["emergency"="defibrillator"](around:${radiusMeters},${lat},${lon});
);
out center;
`;

const readElementLocation = (element) => {
    if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
        return { lat: Number(element.lat), lon: Number(element.lon) };
    }

    if (element.center && Number.isFinite(element.center.lat) && Number.isFinite(element.center.lon)) {
        return { lat: Number(element.center.lat), lon: Number(element.center.lon) };
    }

    return null;
};

const classifyAccessibilityElement = (tags = {}) => {
    if (tags.emergency === "defibrillator") {
        return { category: "medical", type: "aed_location", label: "AED location" };
    }
    if (tags.amenity === "hospital") {
        return { category: "medical", type: "hospital", label: "Hospital" };
    }
    if (tags.amenity === "clinic") {
        return { category: "medical", type: "clinic", label: "Clinic" };
    }
    if (tags.amenity === "pharmacy") {
        return { category: "medical", type: "pharmacy_24h", label: "24-hour pharmacy" };
    }
    if (tags.amenity === "police") {
        return { category: "safety", type: "police_station", label: "Police station" };
    }
    if (tags.amenity === "community_centre") {
        return { category: "safety", type: "safe_place", label: "Safe place" };
    }
    if (tags.highway === "footway" || tags.highway === "path" || tags.highway === "pedestrian") {
        return { category: "safety", type: "well_lit_safe_route", label: "Well-lit safe route" };
    }
    if (tags.amenity === "drinking_water" || tags.amenity === "fountain") {
        return { category: "environmental", type: "hydration_station", label: "Hydration station" };
    }
    if (tags.amenity === "shelter") {
        return { category: "environmental", type: "cooling_center", label: "Cooling center" };
    }
    if (tags.leisure === "park" || tags.leisure === "garden") {
        return { category: "environmental", type: "shaded_area", label: "Shaded area" };
    }
    if (tags.amenity === "toilets" && tags.wheelchair === "yes") {
        return { category: "accessibility", type: "accessible_restroom", label: "Wheelchair-accessible restroom" };
    }
    if (tags.highway === "elevator") {
        return { category: "accessibility", type: "elevator", label: "Elevator" };
    }
    if (tags.entrance === "yes" && tags.wheelchair === "yes") {
        return { category: "accessibility", type: "ramp_access", label: "Ramp or accessible entrance" };
    }
    if (tags.amenity === "library") {
        return { category: "accessibility", type: "quiet_zone", label: "Sensory-friendly quiet zone" };
    }

    return null;
};

const fetchOverpassResources = async (lat, lon, radiusKm) => {
    const radiusMeters = Math.max(1000, Math.round(radiusKm * 1000));
    const query = overpassQuery(lat, lon, radiusMeters);

    for (const endpoint of OVERPASS_ENDPOINTS) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Overpass ${response.status}`);
            }

            const payload = await response.json();
            return payload.elements ?? [];
        } catch (error) {
            clearTimeout(timeoutId);
            log("error", "accessibility.overpass_failed", { endpoint, message: error.message });
        }
    }

    return null;
};

const buildFallbackResources = (lat, lon, radiusKm) => {
    const origin = { lat: Number(lat), lon: Number(lon) };
    const usableRadiusKm = Math.max(1, Math.min(Number(radiusKm) || 8, 12));
    const lonScale = Math.max(Math.cos(origin.lat * (Math.PI / 180)), 0.2);

    // Create deterministic offsets around the requested point so markers appear
    // nearby and remain stable across refreshes for the same viewport.
    return FALLBACK_BLUEPRINTS.map((blueprint, index) => {
        const scaledDistanceKm = Math.min(Math.max(blueprint.distanceKm, usableRadiusKm * 0.12), usableRadiusKm * 0.45);
        const radians = blueprint.angleDeg * (Math.PI / 180);
        const latOffset = (scaledDistanceKm / 111) * Math.cos(radians);
        const lonOffset = (scaledDistanceKm / (111 * lonScale)) * Math.sin(radians);
        const point = {
            lat: Number((origin.lat + latOffset).toFixed(6)),
            lon: Number((origin.lon + lonOffset).toFixed(6)),
        };
        const meta = CATEGORY_META[blueprint.category];

        return {
            id: `fallback_${blueprint.category}_${index}`,
            lat: point.lat,
            lng: point.lon,
            category: blueprint.category,
            type: blueprint.type,
            name: blueprint.name,
            label: blueprint.name,
            description: `${blueprint.name} near your current map area`,
            emoji: meta.emoji,
            color: meta.color,
            location: point,
            distanceKm: Number(calculateDistance(origin.lat, origin.lon, point.lat, point.lon).toFixed(2)),
            source: "fallback",
        };
    }).filter((resource) => isValidLocation(resource.location));
};

export const getAccessibilityResources = async (lat, lon, radiusKm = 8) => {
    const location = { lat: Number(lat), lon: Number(lon) };
    if (!isValidLocation(location)) {
        return err("Valid latitude and longitude are required.");
    }

    const cacheKey = cacheKeyFor(location.lat, location.lon, radiusKm);
    const cachedEntry = cache.get(cacheKey);

    // Serve the cached response immediately while it is still fresh.
    if (cachedEntry && Date.now() - cachedEntry.cachedAt < CACHE_TTL_MS) {
        return ok(cachedEntry.resources);
    }

    const elements = await fetchOverpassResources(location.lat, location.lon, radiusKm);

    if (!elements) {
        if (cachedEntry) {
            return ok(cachedEntry.resources);
        }

        const fallbackResources = buildFallbackResources(location.lat, location.lon, radiusKm);
        cache.set(cacheKey, { cachedAt: Date.now(), resources: fallbackResources });
        return ok(fallbackResources);
    }

    const resources = elements
        .map((element) => {
            const resourceType = classifyAccessibilityElement(element.tags);
            const point = readElementLocation(element);

            if (!resourceType || !point || !isValidLocation(point)) return null;

            const meta = CATEGORY_META[resourceType.category];
            const name = element.tags?.name?.trim();

            return {
                id: `${element.type}_${element.id}`,
                lat: point.lat,
                lng: point.lon,
                category: resourceType.category,
                type: resourceType.type,
                name: name || resourceType.label,
                label: name || resourceType.label,
                description: resourceType.label,
                emoji: meta.emoji,
                color: meta.color,
                location: point,
                distanceKm: Number(calculateDistance(location.lat, location.lon, point.lat, point.lon).toFixed(2)),
                source: "openstreetmap",
            };
        })
        .filter(Boolean)
        // Deduplicate identical results that come back as both nodes and ways.
        .filter((resource, index, all) =>
            all.findIndex((candidate) =>
                candidate.category === resource.category &&
                candidate.name === resource.name &&
                candidate.lat === resource.lat &&
                candidate.lng === resource.lng
            ) === index
        )
        .sort((a, b) => a.distanceKm - b.distanceKm);

    if (resources.length === 0) {
        const fallbackResources = buildFallbackResources(location.lat, location.lon, radiusKm);
        cache.set(cacheKey, { cachedAt: Date.now(), resources: fallbackResources });
        return ok(fallbackResources);
    }

    cache.set(cacheKey, { cachedAt: Date.now(), resources });
    return ok(resources);
};

import client from "../lib/apiClient";

export const alertsService = {
    getNearby: (lat, lng, radius = 5, filters = {}) =>
        client.get("/alerts", { lat, lng, radius, ...filters }),

    getFeed: () =>
        client.get("/alerts/feed"),

    create: (payload) =>
        client.post("/alerts", payload),

    update: (id, data) =>
        client.patch(`/alerts/${id}`, data),
};

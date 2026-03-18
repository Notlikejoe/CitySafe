import client from "../lib/apiClient";

export const reportsService = {
    getNearby: (lat, lng, radius = 5, filters = {}) =>
        client.get("/reports", { lat, lng, radius, ...filters }),

    create: (payload) =>
        client.post("/reports", payload),

    getById: (id) =>
        client.get(`/reports/${id}`),

    updateStatus: (id, status, actorId) =>
        client.patch(`/reports/${id}/status`, { status, actorId }),

    getByUser: (userId) =>
        client.get(`/users/${userId}/reports`),
};

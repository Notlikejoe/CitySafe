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

    // Admin: verify a report
    verify: (id) =>
        client.post(`/reports/${id}/verify`, {}),

    // Admin: reject a report
    reject: (id) =>
        client.post(`/reports/${id}/reject`, {}),

    // Owner: cancel a report
    cancel: (id) =>
        client.delete(`/reports/${id}/cancel`),
};

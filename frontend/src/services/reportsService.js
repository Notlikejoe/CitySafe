import client from "../lib/apiClient";

const MOCK_USER_ID = "user_demo";

export const reportsService = {
    getNearby: (lat, lng, radius = 5, filters = {}) =>
        client.get("/reports", { lat, lng, radius, ...filters }),

    create: (payload) =>
        client.post("/reports", { userId: MOCK_USER_ID, ...payload }),

    getById: (id) =>
        client.get(`/reports/${id}`),

    updateStatus: (id, status, actorId = MOCK_USER_ID) =>
        client.patch(`/reports/${id}/status`, { status, actorId }),

    getByUser: (userId = MOCK_USER_ID) =>
        client.get(`/users/${userId}/reports`),
};

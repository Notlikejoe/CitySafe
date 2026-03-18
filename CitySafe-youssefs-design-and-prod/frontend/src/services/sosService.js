import client from "../lib/apiClient";

const MOCK_USER_ID = "user_demo";

export const sosService = {
    create: (payload) =>
        client.post("/sos", { userId: MOCK_USER_ID, ...payload }),

    getById: (id) =>
        client.get(`/sos/${id}`),

    updateStatus: (id, status, actorId = "system") =>
        client.patch(`/sos/${id}/status`, { status, actorId }),

    getByUser: (userId = MOCK_USER_ID) =>
        client.get(`/users/${userId}/sos`),
};

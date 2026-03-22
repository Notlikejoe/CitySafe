import client from "../lib/apiClient";

export const sosService = {
    create: (payload) =>
        client.post("/sos", payload),

    getById: (id) =>
        client.get(`/sos/${id}`),

    updateStatus: (id, status, actorId = "system") =>
        client.patch(`/sos/${id}/status`, { status, actorId }),

    getByUser: (userId) =>
        client.get(`/users/${userId}/sos`),

    // Owner: cancel a pending SOS request
    cancel: (id) =>
        client.patch(`/sos/${id}/status`, { status: "cancelled" }),
};

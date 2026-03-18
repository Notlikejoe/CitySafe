import client from "../lib/apiClient";

export const historyService = {
    get: (userId, params = {}) =>
        client.get(`/users/${userId}/history`, params),
};

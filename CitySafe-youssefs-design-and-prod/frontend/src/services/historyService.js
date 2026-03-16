import client from "../lib/apiClient";

const MOCK_USER_ID = "user_demo";

export const historyService = {
    get: (userId = MOCK_USER_ID, params = {}) =>
        client.get(`/users/${userId}/history`, params),
};

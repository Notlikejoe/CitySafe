import client from "../lib/apiClient";

const MOCK_USER_ID = "user_demo";

export const pointsService = {
    getBalance: (userId = MOCK_USER_ID) =>
        client.get(`/users/${userId}/points`),

    getLedger: (userId = MOCK_USER_ID) =>
        client.get(`/users/${userId}/points/ledger`),
};

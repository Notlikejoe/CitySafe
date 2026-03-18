import client from "../lib/apiClient";

export const pointsService = {
    getBalance: (userId) =>
        client.get(`/users/${userId}/points`),

    getLedger: (userId) =>
        client.get(`/users/${userId}/points/ledger`),
};

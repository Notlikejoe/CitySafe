import client from "../lib/apiClient";

const MOCK_USER_ID = "user_demo";

export const vouchersService = {
    getByUser: (userId = MOCK_USER_ID) =>
        client.get(`/users/${userId}/vouchers`),

    redeem: (voucherId) =>
        client.post(`/vouchers/${voucherId}/redeem`),
};

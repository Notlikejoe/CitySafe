import client from "../lib/apiClient";

export const vouchersService = {
    getByUser: (userId) =>
        client.get(`/users/${userId}/vouchers`),

    redeem: (voucherId) =>
        client.post(`/vouchers/${voucherId}/redeem`),
};

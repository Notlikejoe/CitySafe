import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vouchersService } from "../services/vouchersService";
import toast from "react-hot-toast";

export const useVouchers = (userId) =>
    useQuery({
        queryKey: ["vouchers", userId],
        queryFn: () => vouchersService.getByUser(userId).then((r) => r.data),
        staleTime: 30_000,
    });

export const useRedeemVoucher = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => vouchersService.redeem(id).then((r) => r.data),
        onSuccess: () => {
            toast.success("Voucher redeemed! Enjoy your reward 🎉");
            qc.invalidateQueries({ queryKey: ["vouchers"] });
        },
        onError: (e) => toast.error(e.message ?? "Failed to redeem voucher"),
    });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sosService } from "../services/sosService";
import toast from "react-hot-toast";

export const useUserSos = (userId) =>
    useQuery({
        queryKey: ["sos", "user", userId],
        queryFn: () => sosService.getByUser(userId).then((r) => r.data),
        staleTime: 30_000,
    });

export const useCreateSos = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload) => sosService.create(payload).then((r) => r.data),
        onSuccess: () => {
            toast.success("Help request sent! Community helpers have been notified.");
            qc.invalidateQueries({ queryKey: ["sos"] });
            qc.invalidateQueries({ queryKey: ["history"] });
        },
        onError: (e) => toast.error(e.message ?? "Failed to send SOS"),
    });
};

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

export const useCancelSos = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => sosService.cancel(id).then((r) => r.data),
        // Optimistic update — immediately mark as cancelled in history cache
        onMutate: async (id) => {
            await qc.cancelQueries({ queryKey: ["history"] });
            const prev = qc.getQueryData(["history"]);
            qc.setQueriesData({ queryKey: ["history"] }, (old) => {
                if (!old?.items) return old;
                return {
                    ...old,
                    items: old.items.map((item) =>
                        item.id === id ? { ...item, status: "cancelled" } : item
                    ),
                };
            });
            return { prev };
        },
        onError: (e, _id, ctx) => {
            if (ctx?.prev) qc.setQueryData(["history"], ctx.prev);
            toast.error(e.message ?? "Failed to cancel SOS request");
        },
        onSuccess: () => {
            toast.success("SOS request cancelled.");
            qc.invalidateQueries({ queryKey: ["sos"] });
            qc.invalidateQueries({ queryKey: ["history"] });
        },
    });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportsService } from "../services/reportsService";
import toast from "react-hot-toast";

export const useNearbyReports = (lat, lng, radius = 5) =>
    useQuery({
        queryKey: ["reports", "nearby", lat, lng, radius],
        queryFn: () => reportsService.getNearby(lat, lng, radius).then((r) => r.data),
        enabled: !!lat && !!lng,
        staleTime: 60_000,
        retry: 2,
    });

export const useReport = (id) =>
    useQuery({
        queryKey: ["reports", id],
        queryFn: () => reportsService.getById(id).then((r) => r.data),
        enabled: !!id,
    });

export const useUserReports = (userId) =>
    useQuery({
        queryKey: ["reports", "user", userId],
        queryFn: () => reportsService.getByUser(userId).then((r) => r.data),
        staleTime: 30_000,
    });

export const useCreateReport = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload) => reportsService.create(payload).then((r) => r.data),
        onSuccess: () => {
            toast.success("Report submitted! Thanks for keeping your community safe 🙌");
            qc.invalidateQueries({ queryKey: ["reports"] });
            qc.invalidateQueries({ queryKey: ["history"] });
        },
        onError: (e) => toast.error(e.message ?? "Failed to submit report"),
    });
};

// ─── Shared optimistic status patcher ─────────────────────────────────────────
/**
 * Returns onMutate/onError/onSettled callbacks that immediately patch the
 * status of report `id` in the history and reports caches, then roll back
 * if the server responds with an error.
 */
function optimisticStatusPatch(qc, newStatus) {
    return {
        onMutate: async (id) => {
            // Cancel any in-flight refetches so they don't overwrite our patch
            await qc.cancelQueries({ queryKey: ["history"] });
            await qc.cancelQueries({ queryKey: ["reports"] });

            const prevHistory = qc.getQueryData(["history"]);
            const prevReports = qc.getQueriesData({ queryKey: ["reports"] });

            // Patch history timeline items
            qc.setQueriesData({ queryKey: ["history"] }, (old) => {
                if (!old?.items) return old;
                return {
                    ...old,
                    items: old.items.map((item) =>
                        item.id === id ? { ...item, status: newStatus } : item
                    ),
                };
            });

            // Patch individual report caches under nearby/user keys
            qc.setQueriesData({ queryKey: ["reports"] }, (old) => {
                if (!Array.isArray(old)) return old;
                return old.map((r) => (r.id === id ? { ...r, status: newStatus } : r));
            });

            return { prevHistory, prevReports };
        },
        onError: (_e, _id, ctx) => {
            if (ctx?.prevHistory) qc.setQueryData(["history"], ctx.prevHistory);
            if (ctx?.prevReports) {
                ctx.prevReports.forEach(([key, data]) => qc.setQueryData(key, data));
            }
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ["reports"] });
            qc.invalidateQueries({ queryKey: ["history"] });
        },
    };
}

export const useVerifyReport = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => reportsService.verify(id).then((r) => r.data),
        ...optimisticStatusPatch(qc, "verified"),
        onSuccess: () => toast.success("Report verified ✅"),
        onError: (e) => toast.error(e.message ?? "Verification failed"),
    });
};

export const useRejectReport = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => reportsService.reject(id).then((r) => r.data),
        ...optimisticStatusPatch(qc, "rejected"),
        onSuccess: () => toast.success("Report rejected"),
        onError: (e) => toast.error(e.message ?? "Rejection failed"),
    });
};

export const useCancelReport = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => reportsService.cancel(id).then((r) => r.data),
        ...optimisticStatusPatch(qc, "cancelled"),
        onSuccess: () => {
            toast.success("Report retracted");
        },
        onError: (e) => toast.error(e.message ?? "Failed to retract report"),
    });
};

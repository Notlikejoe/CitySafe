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

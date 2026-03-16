import { useQuery } from "@tanstack/react-query";
import { pointsService } from "../services/pointsService";

export const usePoints = (userId) =>
    useQuery({
        queryKey: ["points", userId],
        queryFn: () => pointsService.getBalance(userId).then((r) => r.data),
        staleTime: 30_000,
    });

export const usePointsLedger = (userId) =>
    useQuery({
        queryKey: ["points", "ledger", userId],
        queryFn: () => pointsService.getLedger(userId).then((r) => r.data),
        staleTime: 30_000,
    });

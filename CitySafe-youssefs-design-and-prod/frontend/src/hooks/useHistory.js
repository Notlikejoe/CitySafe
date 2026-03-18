import { useQuery } from "@tanstack/react-query";
import { historyService } from "../services/historyService";

export const useHistory = (userId, params = {}) =>
    useQuery({
        queryKey: ["history", userId, params],
        queryFn: () => historyService.get(userId, params).then((r) => r.data),
        staleTime: 30_000,
    });

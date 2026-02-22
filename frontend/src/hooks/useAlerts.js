import { useQuery } from "@tanstack/react-query";
import { alertsService } from "../services/alertsService";

export const useNearbyAlerts = (lat, lng, radius = 5) =>
    useQuery({
        queryKey: ["alerts", "nearby", lat, lng, radius],
        queryFn: () => alertsService.getNearby(lat, lng, radius).then((r) => r.data),
        enabled: !!lat && !!lng,
        staleTime: 120_000,
        retry: 2,
    });

export const useAlertsFeed = () =>
    useQuery({
        queryKey: ["alerts", "feed"],
        queryFn: () => alertsService.getFeed().then((r) => r.data),
        staleTime: 60_000,
    });

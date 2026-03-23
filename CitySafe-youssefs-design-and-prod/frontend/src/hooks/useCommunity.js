import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { communityService } from "../services/communityService";

const normalizeCommunityItem = (item) => ({
    ...item,
    _type: item._type,
    location: {
        lat: Number(item.location?.lat),
        lon: Number(item.location?.lon),
    },
});

export const useCommunityFeed = () =>
    useQuery({
        queryKey: ["community", "feed"],
        queryFn: async () => {
            const response = await communityService.getFeed();
            return (response.data ?? []).map(normalizeCommunityItem);
        },
        staleTime: 10_000,
        refetchInterval: 15_000,
        refetchIntervalInBackground: true,
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    });

export const useRespondMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ requestId, type }) => communityService.respond(requestId, type).then((r) => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["community", "feed"] });
        },
    });
};

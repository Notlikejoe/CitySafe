import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import client from "../lib/apiClient";



export const useSettings = (userId = "") => {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ["settings", userId],
        queryFn: () => client.get(`/users/${userId}/settings`).then((r) => r.data),
        staleTime: 60_000,
        // Provide sensible defaults while loading (no flash of undefined)
        placeholderData: {
            anonymousReports: false,
            notifications: true,
            shareLocation: true,
            reportStatusUpdates: true,
            communityUpdates: false,
        },
    });

    const mutation = useMutation({
        mutationFn: (patch) => client.patch(`/users/${userId}/settings`, patch).then((r) => r.data),
        // Optimistic update: apply change immediately in UI, revert on error
        onMutate: async (patch) => {
            await queryClient.cancelQueries({ queryKey: ["settings", userId] });
            const previous = queryClient.getQueryData(["settings", userId]);
            queryClient.setQueryData(["settings", userId], (old) => ({ ...old, ...patch }));
            return { previous };
        },
        onError: (_err, _patch, context) => {
            queryClient.setQueryData(["settings", userId], context?.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["settings", userId] });
        },
    });

    return { settings: query.data, isLoading: query.isLoading, updateSetting: mutation.mutate };
};

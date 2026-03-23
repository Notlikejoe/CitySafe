import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useSettings } from "./useSettings";

const { clientGetSpy, clientPutSpy } = vi.hoisted(() => ({
  clientGetSpy: vi.fn(),
  clientPutSpy: vi.fn(),
}));

vi.mock("../lib/apiClient", () => ({
  default: {
    get: clientGetSpy,
    put: clientPutSpy,
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe("useSettings", () => {
  beforeEach(() => {
    clientGetSpy.mockReset();
    clientPutSpy.mockReset();
    clientGetSpy.mockResolvedValue({
      data: {
        notifications: true,
        reportStatusUpdates: true,
        communityUpdates: false,
        shareLocation: true,
        anonymousReports: false,
      },
    });
    clientPutSpy.mockResolvedValue({
      data: {
        notifications: true,
        reportStatusUpdates: true,
        communityUpdates: true,
        shareLocation: true,
        anonymousReports: false,
      },
    });
  });

  test("loads persisted settings for the active user", async () => {
    const { result } = renderHook(() => useSettings("user-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.settings.communityUpdates).toBe(false);
    });

    expect(clientGetSpy).toHaveBeenCalledWith("/user/settings");
  });

  test("merges the current settings state before issuing the update call", async () => {
    const { result } = renderHook(() => useSettings("user-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.settings.notifications).toBe(true);
    });

    await act(async () => {
      result.current.updateSetting({ communityUpdates: true });
    });

    await waitFor(() => {
      expect(clientPutSpy).toHaveBeenCalledWith("/user/settings", {
        notifications: true,
        reportStatusUpdates: true,
        communityUpdates: true,
        shareLocation: true,
        anonymousReports: false,
      });
    });
  });
});

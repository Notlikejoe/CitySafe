import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { getAccessibilityResources } from "../features/accessibility.js";

describe("Accessibility resource reuse handling", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test("returns fallback accessibility resources when Overpass fails", async () => {
        global.fetch.mockRejectedValue(new Error("network down"));

        const result = await getAccessibilityResources(29.3065, 47.9203, 8);

        expect(result.success).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data.every((resource) =>
            Number.isFinite(resource.lat) &&
            Number.isFinite(resource.lng) &&
            typeof resource.category === "string" &&
            typeof resource.name === "string"
        )).toBe(true);
        expect(result.data.some((resource) => resource.source === "fallback")).toBe(true);
    });

    test("returns fallback accessibility resources when Overpass returns an empty dataset", async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ elements: [] }),
        });

        const result = await getAccessibilityResources(29.376, 47.9774, 6);

        expect(result.success).toBe(true);
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data.some((resource) => resource.category === "medical")).toBe(true);
        expect(result.data.some((resource) => resource.category === "safety")).toBe(true);
    });
});

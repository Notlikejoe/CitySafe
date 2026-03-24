import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockQuery = jest.fn();

jest.unstable_mockModule("../db.js", () => ({
    query: mockQuery,
}));

const { createSosRequest } = await import("../features/sos.js");

describe("sos.js unit validation", () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    test("rejects SOS creation when location is invalid", async () => {
        const result = await createSosRequest("user-1", {
            type: "medical",
            urgency: "high",
            description: "Need urgent help",
            location: { lat: 999, lon: 47.9203 },
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/latitude and longitude/i);
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

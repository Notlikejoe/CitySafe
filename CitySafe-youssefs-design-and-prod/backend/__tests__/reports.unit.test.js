import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockQuery = jest.fn();
const mockAwardPoints = jest.fn();

jest.unstable_mockModule("../db.js", () => ({
    query: mockQuery,
}));

jest.unstable_mockModule("../features/points.js", () => ({
    awardPoints: mockAwardPoints,
}));

const { createReport } = await import("../features/reports.js");

describe("reports.js unit validation", () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockAwardPoints.mockReset();
    });

    test("rejects report creation when description is too short", async () => {
        const result = await createReport("user-1", {
            type: "fire",
            description: "no",
            location: { lat: 29.3065, lon: 47.9203 },
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/description/i);
        expect(mockQuery).not.toHaveBeenCalled();
        expect(mockAwardPoints).not.toHaveBeenCalled();
    });
});

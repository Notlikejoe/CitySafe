import fs from "fs/promises";
import os from "os";
import path from "path";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, beforeEach, afterAll, describe, expect, jest, test } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const mockQuery = jest.fn();
const mockCreateReport = jest.fn();
const mockTransitionReportStatus = jest.fn();
const mockGetNearbyReports = jest.fn();
const mockGetReportsByUser = jest.fn();
const mockAdminVerifyReport = jest.fn();
const mockAdminRejectReport = jest.fn();
const mockCancelReport = jest.fn();
const mockCreateAlert = jest.fn();
const mockGetActiveAlerts = jest.fn();
const mockCreateSosRequest = jest.fn();
const mockUpdateSosStatus = jest.fn();
const mockGetActiveSosRequests = jest.fn();
const mockGetSosRequestsByUser = jest.fn();
const mockAwardPoints = jest.fn();
const mockGetPointsLeaderboard = jest.fn();
const mockGetUserLedger = jest.fn();
const mockGetVouchers = jest.fn();
const mockRedeemVoucher = jest.fn();
const mockGetUserHistory = jest.fn();
const mockGetCrowdZones = jest.fn();
const mockGetAccessibilityResources = jest.fn();
const mockSearchContent = jest.fn();

jest.unstable_mockModule("../db.js", () => ({
    query: mockQuery,
}));

jest.unstable_mockModule("../features/reports.js", () => ({
    createReport: mockCreateReport,
    transitionReportStatus: mockTransitionReportStatus,
    getNearbyReports: mockGetNearbyReports,
    getReportsByUser: mockGetReportsByUser,
    adminVerifyReport: mockAdminVerifyReport,
    adminRejectReport: mockAdminRejectReport,
    cancelReport: mockCancelReport,
}));

jest.unstable_mockModule("../features/alerts.js", () => ({
    createAlert: mockCreateAlert,
    getActiveAlerts: mockGetActiveAlerts,
}));

jest.unstable_mockModule("../features/sos.js", () => ({
    createSosRequest: mockCreateSosRequest,
    updateSosStatus: mockUpdateSosStatus,
    getActiveSosRequests: mockGetActiveSosRequests,
    getSosRequestsByUser: mockGetSosRequestsByUser,
}));

jest.unstable_mockModule("../features/points.js", () => ({
    awardPoints: mockAwardPoints,
    getPointsLeaderboard: mockGetPointsLeaderboard,
    getUserLedger: mockGetUserLedger,
}));

jest.unstable_mockModule("../features/vouchers.js", () => ({
    getVouchers: mockGetVouchers,
    redeemVoucher: mockRedeemVoucher,
}));

jest.unstable_mockModule("../features/history.js", () => ({
    getUserHistory: mockGetUserHistory,
}));

jest.unstable_mockModule("../features/crowd.js", () => ({
    getCrowdZones: mockGetCrowdZones,
}));

jest.unstable_mockModule("../features/accessibility.js", () => ({
    getAccessibilityResources: mockGetAccessibilityResources,
}));

jest.unstable_mockModule("../features/search.js", () => ({
    searchContent: mockSearchContent,
}));

const { app } = await import("../server.js");

const authCookie = (userId = "user-1", role = "member") => {
    const token = jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "1h" });
    return `cs_token=${token}`;
};

let tempImagePath = "";

beforeAll(async () => {
    tempImagePath = path.join(os.tmpdir(), "citysafe-test-upload.png");
    await fs.writeFile(
        tempImagePath,
        Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010802000000907724de0000000a49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex"),
    );
});

afterAll(async () => {
    await fs.unlink(tempImagePath).catch(() => {});
});

beforeEach(() => {
    jest.clearAllMocks();

    mockCreateReport.mockResolvedValue({
        success: true,
        data: {
            id: "report-1",
            type: "fire",
            description: "Smoke reported",
            imageUrl: "/uploads/report-1.png",
            status: "under_review",
            location: { lat: 29.3, lon: 47.92 },
        },
    });
    mockCreateSosRequest.mockResolvedValue({
        success: true,
        data: {
            id: "sos-1",
            type: "medical",
            urgency: "high",
            status: "pending",
            description: "Medical support needed",
            location: { lat: 29.3, lon: 47.92 },
        },
    });
    mockUpdateSosStatus.mockResolvedValue({
        success: true,
        data: { id: "sos-1", status: "resolved" },
    });

    mockQuery.mockResolvedValue({
        success: true,
        data: { rows: [], rowCount: 0 },
    });
});

describe("CitySafe backend routes", () => {
    test("GET /api/user/me returns the authenticated user profile for protected routes", async () => {
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes("INSERT INTO user_settings") && sql.includes("ON CONFLICT (user_id) DO NOTHING")) {
                return { success: true, data: { rows: [], rowCount: 1 } };
            }
            if (sql.includes("FROM users u") && sql.includes("LEFT JOIN user_settings")) {
                return {
                    success: true,
                    data: {
                        rows: [{
                            id: "owner-1",
                            username: "owner_demo",
                            name: "Owner Demo",
                            email: "owner@citysafe.app",
                            role: "member",
                            notifications: true,
                            report_status_updates: true,
                            community_updates: false,
                            share_location: true,
                            anonymous_reports: false,
                        }],
                    },
                };
            }
            return { success: true, data: { rows: [], rowCount: 0 } };
        });

        const response = await request(app)
            .get("/api/user/me")
            .set("Cookie", authCookie("owner-1"));

        expect(response.status).toBe(200);
        expect(response.body.userId).toBe("owner-1");
        expect(response.body.name).toBe("Owner Demo");
        expect(response.body.settings.notifications).toBe(true);
    });

    test("POST /api/upload accepts multipart form-data and returns an uploads path", async () => {
        const response = await request(app)
            .post("/api/upload")
            .set("Cookie", authCookie())
            .attach("image", tempImagePath);

        expect(response.status).toBe(201);
        expect(response.body.imageUrl).toMatch(/^\/uploads\/.+\.png$/);

        const uploadedFilename = response.body.imageUrl.split("/").pop();
        const uploadedPath = path.join(
            "/Users/dj/Desktop/CitySafe FULL APP /CitySafe-youssefs-design-and-prod/backend/uploads",
            uploadedFilename,
        );
        await expect(fs.access(uploadedPath)).resolves.toBeUndefined();
    });

    test("POST /api/reports forwards normalized report payloads to report creation", async () => {
        const response = await request(app)
            .post("/api/reports")
            .set("Cookie", authCookie("owner-1"))
            .send({
                type: "fire",
                description: "Smoke reported",
                imageUrl: "/uploads/report-1.png",
                location: { lat: 29.3065, lon: 47.9203 },
            });

        expect(response.status).toBe(201);
        expect(mockCreateReport).toHaveBeenCalledWith("owner-1", expect.objectContaining({
            type: "fire",
            description: "Smoke reported",
            imageUrl: "/uploads/report-1.png",
            location: { lat: 29.3065, lon: 47.9203 },
        }));
    });

    test("PATCH /api/reports/:id/resolve allows owners to resolve their reports", async () => {
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes("SELECT") && sql.includes("FROM reports")) {
                return {
                    success: true,
                    data: { rows: [{ id: "report-1", author_id: "owner-1", status: "under_review" }] },
                };
            }
            if (sql.includes("UPDATE reports SET status = 'resolved'")) {
                return {
                    success: true,
                    data: { rows: [{ id: "report-1", status: "resolved" }] },
                };
            }
            return { success: true, data: { rows: [], rowCount: 0 } };
        });

        const response = await request(app)
            .patch("/api/reports/report-1/resolve")
            .set("Cookie", authCookie("owner-1"));

        expect(response.status).toBe(200);
        expect(response.body.status).toBe("resolved");
    });

    test("DELETE /api/reports/:id allows owners to delete their reports", async () => {
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes("SELECT id, author_id FROM reports")) {
                return {
                    success: true,
                    data: { rows: [{ id: "report-1", author_id: "owner-1" }] },
                };
            }
            if (sql.includes("DELETE FROM reports")) {
                return {
                    success: true,
                    data: { rows: [], rowCount: 1 },
                };
            }
            return { success: true, data: { rows: [], rowCount: 0 } };
        });

        const response = await request(app)
            .delete("/api/reports/report-1")
            .set("Cookie", authCookie("owner-1"));

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true, id: "report-1" });
    });

    test("POST /api/sos creates an SOS request with the submitted payload", async () => {
        const response = await request(app)
            .post("/api/sos")
            .set("Cookie", authCookie("owner-1"))
            .send({
                type: "medical",
                urgency: "high",
                description: "Medical support needed",
                location: { lat: 29.3065, lon: 47.9203 },
            });

        expect(response.status).toBe(201);
        expect(mockCreateSosRequest).toHaveBeenCalledWith("owner-1", expect.objectContaining({
            type: "medical",
            urgency: "high",
            description: "Medical support needed",
        }));
    });

    test("PATCH /api/sos/:id/resolve resolves requester-owned SOS requests", async () => {
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes("SELECT id, requester_id FROM sos_requests")) {
                return {
                    success: true,
                    data: { rows: [{ id: "sos-1", requester_id: "owner-1" }] },
                };
            }
            return { success: true, data: { rows: [], rowCount: 0 } };
        });

        const response = await request(app)
            .patch("/api/sos/sos-1/resolve")
            .set("Cookie", authCookie("owner-1"))
            .send({});

        expect(response.status).toBe(200);
        expect(mockUpdateSosStatus).toHaveBeenCalledWith("sos-1", "resolved");
        expect(response.body.status).toBe("resolved");
    });

    test("POST /api/ratings stores a responder rating after a community response", async () => {
        let ratingsInserted = false;
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes("SELECT id, status FROM reports WHERE id = $1")) {
                return {
                    success: true,
                    data: { rows: [{ id: "report-9", status: "under_review" }] },
                };
            }
            if (sql.includes("SELECT id, author_id, status FROM reports WHERE id = $1")) {
                return {
                    success: true,
                    data: { rows: [{ id: "report-9", author_id: "owner-1", status: "resolved" }] },
                };
            }
            if (sql.includes("INSERT INTO ratings")) {
                ratingsInserted = true;
                return {
                    success: true,
                    data: {
                        rows: [{
                            id: "rating-1",
                            reportId: "report-9",
                            userId: "helper-1",
                            rating: 5,
                            createdAt: "2026-03-23T10:00:00.000Z",
                        }],
                    },
                };
            }
            return { success: true, data: { rows: [], rowCount: 0 } };
        });

        const helperCookie = authCookie("helper-1");
        const ownerCookie = authCookie("owner-1");

        const respondResponse = await request(app)
            .post("/api/community/respond")
            .set("Cookie", helperCookie)
            .send({ requestId: "report-9", type: "report" });

        expect(respondResponse.status).toBe(200);

        const ratingResponse = await request(app)
            .post("/api/ratings")
            .set("Cookie", ownerCookie)
            .send({ reportId: "report-9", rating: 5 });

        expect(ratingResponse.status).toBe(201);
        expect(ratingsInserted).toBe(true);
        expect(ratingResponse.body.rating).toBe(5);
    });

    test("PUT /api/user/settings persists user settings and returns merged state", async () => {
        let storedSettings = {
            notifications: true,
            report_status_updates: true,
            community_updates: false,
            share_location: true,
            anonymous_reports: false,
        };

        mockQuery.mockImplementation(async (sql, params) => {
            if (sql.includes("INSERT INTO user_settings") && sql.includes("ON CONFLICT (user_id) DO NOTHING")) {
                return { success: true, data: { rows: [], rowCount: 1 } };
            }
            if (sql.includes("SELECT notifications, report_status_updates, community_updates, share_location, anonymous_reports")) {
                return { success: true, data: { rows: [storedSettings], rowCount: 1 } };
            }
            if (sql.includes("ON CONFLICT (user_id) DO UPDATE SET")) {
                storedSettings = {
                    notifications: params[1],
                    report_status_updates: params[2],
                    community_updates: params[3],
                    share_location: params[4],
                    anonymous_reports: params[5],
                };
                return { success: true, data: { rows: [storedSettings], rowCount: 1 } };
            }
            return { success: true, data: { rows: [], rowCount: 0 } };
        });

        const response = await request(app)
            .put("/api/user/settings")
            .set("Cookie", authCookie("owner-1"))
            .send({ communityUpdates: true, anonymousReports: true });

        expect(response.status).toBe(200);
        expect(response.body.communityUpdates).toBe(true);
        expect(response.body.anonymousReports).toBe(true);
        expect(response.body.notifications).toBe(true);
    });
});

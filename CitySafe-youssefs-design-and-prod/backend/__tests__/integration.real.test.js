import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import request from "supertest";
import { beforeAll, afterAll, afterEach, describe, expect, test } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const HAS_DATABASE = Boolean(process.env.DATABASE_URL);
const describeIfDb = HAS_DATABASE ? describe : describe.skip;

let app;
let query;
let pool;

const createdUsernames = new Set();

const uniqueUserId = (prefix) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const extractCookie = (response) =>
    response.headers["set-cookie"]?.find((value) => value.startsWith("cs_token="));

const registerUser = async (prefix) => {
    const userId = uniqueUserId(prefix);
    const response = await request(app)
        .post("/api/auth/register")
        .send({
            userId,
            password: "Test123",
            displayName: `${prefix} user`,
        });

    expect(response.status).toBe(201);
    const cookie = extractCookie(response);
    expect(cookie).toBeTruthy();
    createdUsernames.add(userId);

    return { userId, cookie };
};

describeIfDb("CitySafe real backend integration", () => {
    beforeAll(async () => {
        ({ app } = await import("../server.js"));
        ({ query, pool } = await import("../db.js"));

        const schemaSql = await fs.readFile(path.join(__dirname, "..", "init.sql"), "utf8");
        await query(schemaSql);
        await query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS image_url TEXT`);
        await query(`ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS image_url TEXT`);
        await query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                notifications BOOLEAN DEFAULT true,
                report_status_updates BOOLEAN DEFAULT true,
                community_updates BOOLEAN DEFAULT false,
                share_location BOOLEAN DEFAULT true,
                anonymous_reports BOOLEAN DEFAULT false,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        await query(`
            CREATE TABLE IF NOT EXISTS ratings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE (report_id, user_id)
            )
        `);
    });

    afterEach(async () => {
        if (!query) return;
        for (const username of createdUsernames) {
            await query(`DELETE FROM users WHERE username = $1`, [username]);
        }
        createdUsernames.clear();
    });

    afterAll(async () => {
        await pool?.end();
    });

    test("POST /api/reports persists a report in PostgreSQL without mocks", async () => {
        const { cookie } = await registerUser("report_integration");

        const response = await request(app)
            .post("/api/reports")
            .set("Cookie", cookie)
            .send({
                type: "fire",
                description: "Smoke visible beside the station",
                location: { lat: 29.3065, lon: 47.9203 },
            });

        expect(response.status).toBe(201);
        expect(response.body.type).toBe("fire");
        expect(response.body.description).toBe("Smoke visible beside the station");

        const persisted = await query(
            `SELECT type, description, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
             FROM reports WHERE id = $1`,
            [response.body.id]
        );

        expect(persisted.success).toBe(true);
        expect(persisted.data.rows).toHaveLength(1);
        expect(persisted.data.rows[0].type).toBe("fire");
        expect(persisted.data.rows[0].description).toBe("Smoke visible beside the station");
        expect(Number(persisted.data.rows[0].lat)).toBeCloseTo(29.3065, 4);
        expect(Number(persisted.data.rows[0].lon)).toBeCloseTo(47.9203, 4);
    });

    test("GET /api/community/feed returns persisted active reports and SOS items", async () => {
        const { cookie } = await registerUser("feed_integration");

        const reportResponse = await request(app)
            .post("/api/reports")
            .set("Cookie", cookie)
            .send({
                type: "construction",
                description: "Roadworks blocking one lane",
                location: { lat: 29.31, lon: 47.93 },
            });

        expect(reportResponse.status).toBe(201);

        const sosResponse = await request(app)
            .post("/api/sos")
            .set("Cookie", cookie)
            .send({
                type: "medical",
                urgency: "high",
                description: "Need urgent assistance",
                location: { lat: 29.305, lon: 47.925 },
            });

        expect(sosResponse.status).toBe(201);

        const feedResponse = await request(app)
            .get("/api/community/feed")
            .set("Cookie", cookie);

        expect(feedResponse.status).toBe(200);
        expect(Array.isArray(feedResponse.body)).toBe(true);
        expect(feedResponse.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: reportResponse.body.id,
                    _type: "report",
                    type: "construction",
                    description: "Roadworks blocking one lane",
                }),
                expect.objectContaining({
                    id: sosResponse.body.id,
                    _type: "sos",
                    type: "medical",
                    urgency: "high",
                    description: "Need urgent assistance",
                }),
            ])
        );
    });

    test("GET /api/community/feed rejects unauthenticated access with 401", async () => {
        const response = await request(app).get("/api/community/feed");

        expect(response.status).toBe(401);
        expect(response.body.error).toMatch(/missing|invalid token/i);
    });

    test("DELETE /api/reports/:id/cancel returns 403 for a non-owner", async () => {
        const owner = await registerUser("owner_cancel");
        const stranger = await registerUser("stranger_cancel");

        const reportResponse = await request(app)
            .post("/api/reports")
            .set("Cookie", owner.cookie)
            .send({
                type: "fire",
                description: "Flames visible from apartment balcony",
                location: { lat: 29.3001, lon: 47.9001 },
            });

        expect(reportResponse.status).toBe(201);

        const cancelResponse = await request(app)
            .delete(`/api/reports/${reportResponse.body.id}/cancel`)
            .set("Cookie", stranger.cookie);

        expect(cancelResponse.status).toBe(403);
        expect(cancelResponse.body.error).toMatch(/owner/i);
    });

    test("POST /api/reports returns 400 for an invalid description", async () => {
        const { cookie } = await registerUser("invalid_report");

        const response = await request(app)
            .post("/api/reports")
            .set("Cookie", cookie)
            .send({
                type: "pothole",
                description: "no",
                location: { lat: 29.304, lon: 47.922 },
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/description/i);
    });
});

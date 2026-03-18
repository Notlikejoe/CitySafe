/**
 * CitySafe Domain Tests
 * Uses Jest. Each suite resets global store to prevent pollution.
 */

import { resetStore, REPORT_TYPE, REPORT_STATUS, SOS_TYPE, SOS_URGENCY, SOS_STATUS, ALERT_TYPE, ALERT_PRIORITY } from "../store.js";
import { createReport, transitionReportStatus, getNearbyReports, getReportsByUser, adminVerifyReport, adminRejectReport } from "../features/reports.js";
import { createAlert, getNearbyAlerts, deactivateAlert } from "../features/alerts.js";
import { createSos, transitionSosStatus, getUserSosHistory } from "../features/sos.js";
import { getUserBalance, awardPoints, getUserPointsLedger } from "../features/points.js";
import { redeemVoucher, getUserVouchers } from "../features/vouchers.js";
import { getUserHistory } from "../features/history.js";

// ─── Shared test fixtures ────────────────────────────────────────────────────
const USER_A = "user_alice_test";
const USER_B = "user_bob_test";
const ADMIN_ID = "admin_test_01";
const DUBAI = { lat: 25.2048, lon: 55.2708 };
const NEARBY = { lat: 25.208, lon: 55.273 };
const FAR = { lat: 25.5000, lon: 55.9000 };

// Reset store before every test to prevent global state pollution
beforeEach(() => {
    resetStore();
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────
describe("Reports", () => {
    test("creates a valid report", () => {
        const result = createReport({ userId: USER_A, location: DUBAI, type: REPORT_TYPE.POTHOLE, description: "Large hole on main road" });
        expect(result.success).toBe(true);
        expect(result.data.status).toBe(REPORT_STATUS.SUBMITTED);
        expect(result.data.userId).toBe(USER_A);
    });

    test("rejects report with invalid type", () => {
        const result = createReport({ userId: USER_A, location: DUBAI, type: "alien_crash", description: "Something unusual here" });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid report type/i);
    });

    test("rejects report with description too short", () => {
        const result = createReport({ userId: USER_A, location: DUBAI, type: REPORT_TYPE.FIRE, description: "ab" });
        expect(result.success).toBe(false);
    });

    test("rejects report with invalid coordinates", () => {
        const result = createReport({ userId: USER_A, location: { lat: 999, lon: 55 }, type: REPORT_TYPE.CRIME, description: "Suspicious activity" });
        expect(result.success).toBe(false);
    });

    test("returns nearby reports within radius", () => {
        createReport({ userId: USER_A, location: NEARBY, type: REPORT_TYPE.FLOODING, description: "Flooding on the road" });
        const result = getNearbyReports(DUBAI, 2.0);
        expect(result.success).toBe(true);
        expect(result.data.items.length).toBeGreaterThanOrEqual(1);
    });

    test("returns 0 reports beyond radius", () => {
        createReport({ userId: USER_A, location: FAR, type: REPORT_TYPE.POTHOLE, description: "Pothole far away" });
        const result = getNearbyReports(DUBAI, 1.0);
        expect(result.success).toBe(true);
        expect(result.data.items.length).toBe(0);
    });

    test("admin can verify a report in under_review status", () => {
        const r = createReport({ userId: USER_A, location: DUBAI, type: REPORT_TYPE.POTHOLE, description: "Pothole to verify" });
        transitionReportStatus(r.data.id, REPORT_STATUS.UNDER_REVIEW, ADMIN_ID);
        const verify = adminVerifyReport(r.data.id, ADMIN_ID);
        expect(verify.success).toBe(true);
        expect(verify.data.status).toBe(REPORT_STATUS.VERIFIED);
    });

    test("non-admin cannot verify a report", () => {
        const r = createReport({ userId: USER_A, location: DUBAI, type: REPORT_TYPE.POTHOLE, description: "Pothole to verify" });
        transitionReportStatus(r.data.id, REPORT_STATUS.UNDER_REVIEW, ADMIN_ID);
        const verify = adminVerifyReport(r.data.id, USER_A);
        expect(verify.success).toBe(false);
    });

    test("blocks transition from terminal resolved state", () => {
        const r = createReport({ userId: USER_A, location: DUBAI, type: REPORT_TYPE.POTHOLE, description: "Pothole full lifecycle" });
        transitionReportStatus(r.data.id, REPORT_STATUS.UNDER_REVIEW, ADMIN_ID);
        adminVerifyReport(r.data.id, ADMIN_ID);
        transitionReportStatus(r.data.id, REPORT_STATUS.RESOLVED, ADMIN_ID);
        const bad = transitionReportStatus(r.data.id, REPORT_STATUS.UNDER_REVIEW, ADMIN_ID);
        expect(bad.success).toBe(false);
    });
});

// ─── ALERTS ──────────────────────────────────────────────────────────────────
describe("Alerts", () => {
    test("creates a valid alert", () => {
        const result = createAlert({ type: ALERT_TYPE.FLOODING, priority: ALERT_PRIORITY.HIGH, location: DUBAI, message: "Flash flood near marina" });
        expect(result.success).toBe(true);
        expect(result.data.active).toBe(true);
    });

    test("rejects duplicate alert within 500m", () => {
        createAlert({ type: ALERT_TYPE.FLOODING, priority: ALERT_PRIORITY.HIGH, location: DUBAI, message: "Flash flood near marina" });
        const dup = createAlert({ type: ALERT_TYPE.FLOODING, priority: ALERT_PRIORITY.HIGH, location: NEARBY, message: "Another flood warning" });
        expect(dup.success).toBe(false);
    });

    test("rejects alert with invalid priority", () => {
        const result = createAlert({ type: ALERT_TYPE.EMERGENCY, priority: "critical", location: DUBAI, message: "Test emergency message" });
        expect(result.success).toBe(false);
    });

    test("deactivates an alert", () => {
        const a = createAlert({ type: ALERT_TYPE.CONSTRUCTION, priority: ALERT_PRIORITY.LOW, location: DUBAI, message: "Road works starting tomorrow" });
        const result = deactivateAlert(a.data.id, ADMIN_ID);
        expect(result.success).toBe(true);
        expect(result.data.active).toBe(false);
    });

    test("blocks double deactivation", () => {
        const a = createAlert({ type: ALERT_TYPE.CONSTRUCTION, priority: ALERT_PRIORITY.LOW, location: DUBAI, message: "Road works starting next week" });
        deactivateAlert(a.data.id, ADMIN_ID);
        const second = deactivateAlert(a.data.id, ADMIN_ID);
        expect(second.success).toBe(false);
    });
});

// ─── SOS ─────────────────────────────────────────────────────────────────────
describe("SOS", () => {
    test("creates a valid SOS", () => {
        const result = createSos({ userId: USER_B, type: SOS_TYPE.CAR_TROUBLE, location: NEARBY, urgency: SOS_URGENCY.MEDIUM, description: "Flat tyre help" });
        expect(result.success).toBe(true);
        expect(result.data.status).toBe(SOS_STATUS.PENDING);
    });

    test("blocks second active SOS from same user", () => {
        createSos({ userId: USER_B, type: SOS_TYPE.CAR_TROUBLE, location: NEARBY, urgency: SOS_URGENCY.LOW });
        const second = createSos({ userId: USER_B, type: SOS_TYPE.OTHER, location: NEARBY, urgency: SOS_URGENCY.LOW });
        expect(second.success).toBe(false);
    });

    test("medical SOS bypasses cooldown", () => {
        const s = createSos({ userId: USER_B, type: SOS_TYPE.CAR_TROUBLE, location: NEARBY, urgency: SOS_URGENCY.LOW });
        transitionSosStatus(s.data.id, SOS_STATUS.ACCEPTED, ADMIN_ID);
        transitionSosStatus(s.data.id, SOS_STATUS.IN_PROGRESS, ADMIN_ID);
        transitionSosStatus(s.data.id, SOS_STATUS.RESOLVED, ADMIN_ID);
        // Cooldown active now — but medical bypasses it
        const medical = createSos({ userId: USER_B, type: SOS_TYPE.MEDICAL, location: NEARBY, urgency: SOS_URGENCY.HIGH });
        expect(medical.success).toBe(true);
    });

    test("rejects invalid SOS type", () => {
        const result = createSos({ userId: USER_A, type: "pizza_delivery", location: DUBAI, urgency: SOS_URGENCY.HIGH });
        expect(result.success).toBe(false);
    });

    test("blocks invalid status transitions", () => {
        const s = createSos({ userId: USER_B, type: SOS_TYPE.CAR_TROUBLE, location: NEARBY, urgency: SOS_URGENCY.MEDIUM });
        const bad = transitionSosStatus(s.data.id, SOS_STATUS.RESOLVED, ADMIN_ID);
        expect(bad.success).toBe(false);
    });
});

// ─── POINTS ──────────────────────────────────────────────────────────────────
describe("Points", () => {
    test("awards points correctly", () => {
        const result = awardPoints({ userId: USER_A, reason: "manual_admin_grant", referenceId: "ref_001", overrideAmount: 100 });
        expect(result.success).toBe(true);
        const balance = getUserBalance(USER_A);
        expect(balance.data.balance).toBe(100);
    });

    test("blocks duplicate reward for same reference", () => {
        awardPoints({ userId: USER_A, reason: "report_verified", referenceId: "report_abc" });
        const dup = awardPoints({ userId: USER_A, reason: "report_verified", referenceId: "report_abc" });
        expect(dup.success).toBe(false);
    });

    test("rejects invalid reward reason", () => {
        const result = awardPoints({ userId: USER_A, reason: "just_because", referenceId: "ref_x" });
        expect(result.success).toBe(false);
    });
});

// ─── HISTORY ─────────────────────────────────────────────────────────────────
describe("User History", () => {
    test("returns unified history with summary", () => {
        createReport({ userId: USER_A, location: DUBAI, type: REPORT_TYPE.POTHOLE, description: "History test pothole" });
        const result = getUserHistory(USER_A, { page: 1, pageSize: 10 });
        expect(result.success).toBe(true);
        expect(result.data.items.length).toBeGreaterThanOrEqual(1);
        expect(typeof result.data.summary.pointBalance).toBe("number");
    });

    test("filters history by type", () => {
        createReport({ userId: USER_A, location: DUBAI, type: REPORT_TYPE.POTHOLE, description: "Type filter test" });
        createSos({ userId: USER_A, type: SOS_TYPE.OTHER, location: DUBAI, urgency: SOS_URGENCY.LOW });
        const result = getUserHistory(USER_A, { type: "report", page: 1, pageSize: 10 });
        expect(result.success).toBe(true);
        expect(result.data.items.every((e) => e._type === "report")).toBe(true);
    });

    test("rejects invalid type filter", () => {
        const result = getUserHistory(USER_A, { type: "alien_activity", page: 1, pageSize: 10 });
        expect(result.success).toBe(false);
    });
});

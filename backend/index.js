/**
 * CitySafe Backend â€” Main Entry Point & Full Example Flow
 *
 * Demonstrates and tests all 6 feature modules across multiple scenarios.
 * Run with: node index.js
 */

import { createReport, transitionReportStatus, getNearbyReports, getReportsByUser, adminVerifyReport, adminRejectReport } from "./features/reports.js";
import { createAlert, getNearbyAlerts, getAlertsFeed, deactivateAlert } from "./features/alerts.js";
import { createSos, transitionSosStatus, getUserSosHistory } from "./features/sos.js";
import { getUserBalance, getUserPointsLedger, awardPoints } from "./features/points.js";
import { redeemVoucher, getUserVouchers } from "./features/vouchers.js";
import { getUserHistory } from "./features/history.js";
import { REPORT_TYPE, ALERT_TYPE, ALERT_PRIORITY, SOS_TYPE, SOS_URGENCY, REPORT_STATUS, SOS_STATUS, resetStore } from "./store.js";

// â”€â”€â”€ Test Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let passed = 0;
let failed = 0;

// Ensure a perfectly clean state every test run (unaffected by persistence)
resetStore();

const assert = (label, result, expectSuccess, matcher = null) => {
    const ok = result.success === expectSuccess &&
        (matcher ? matcher(result) : true);
    if (ok) {
        console.log(`  âœ… ${label}`);
        passed++;
    } else {
        console.error(`  âŒ ${label}`);
        console.error(`     Got:`, JSON.stringify(result, null, 2));
        failed++;
    }
};

const section = (name) => console.log(`\nâ”€â”€ ${name} â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€`);

// â”€â”€â”€ Mock Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const USER_A = "user_alice";
const USER_B = "user_bob";
const ADMIN_ID = "admin_01";
const DUBAI_HQ = { lat: 25.2048, lon: 55.2708 };   // downtown
const NEARBY = { lat: 25.208, lon: 55.273 };     // ~500m away
const FAR_AWAY = { lat: 25.3000, lon: 55.4000 };    // ~18km away

// â”€â”€â”€ 1. Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

section("REPORTS â€” Pinpoint System");

// Valid report creation
const r1 = createReport({ userId: USER_A, location: DUBAI_HQ, type: REPORT_TYPE.POTHOLE, description: "Large pothole near fountain" });
assert("Create report - valid", r1, true, (res) => res.data.status === REPORT_STATUS.SUBMITTED);
const reportId = r1.data?.id;

// Duplicate in same step â€” just second report
const r2 = createReport({ userId: USER_A, location: NEARBY, type: REPORT_TYPE.FLOODING, description: "Street flooding after rain" });
assert("Create second report", r2, true);
const report2Id = r2.data?.id;

// Invalid type
assert("Create report - invalid type", createReport({ userId: USER_A, location: DUBAI_HQ, type: "ufo_sighting", description: "Alien landed here" }), false);
// Missing description
assert("Create report - missing description", createReport({ userId: USER_A, location: DUBAI_HQ, type: REPORT_TYPE.FIRE, description: "ab" }), false);
// Invalid location
assert("Create report - bad location", createReport({ userId: USER_A, location: { lat: 999, lon: 55 }, type: REPORT_TYPE.CRIME, description: "Suspicious activity" }), false);

// Lifecycle transitions
const t1 = transitionReportStatus(reportId, REPORT_STATUS.UNDER_REVIEW, ADMIN_ID);
assert("Transition: submitted â†’ under_review", t1, true);

// Invalid transition (skip under_review)
const bad = createReport({ userId: USER_B, location: NEARBY, type: REPORT_TYPE.OTHER, description: "Some issue here" });
assert("Bad transition: submitted â†’ verified (skip step)", transitionReportStatus(bad.data.id, REPORT_STATUS.VERIFIED, ADMIN_ID), false);

// Admin verify
assert("Admin verify report", adminVerifyReport(reportId, ADMIN_ID), true);
// Admin verify with non-admin
assert("Admin verify - non-admin rejected", adminVerifyReport(report2Id, USER_A), false);
// Resolve the report (valid: verified â†’ resolved)
assert("Transition: verified â†’ resolved", transitionReportStatus(reportId, REPORT_STATUS.RESOLVED, ADMIN_ID), true);
// Now try to transition again from a terminal state (resolved â†’ anything should block)
assert("Transition from terminal 'resolved' state blocked", transitionReportStatus(reportId, REPORT_STATUS.UNDER_REVIEW, ADMIN_ID), false);

// Admin reject
const r3 = createReport({ userId: USER_B, location: NEARBY, type: REPORT_TYPE.CONSTRUCTION, description: "Construction blocking road" });
const r3id = r3.data?.id;
assert("Admin reject report (auto-advances to under_review)", adminRejectReport(r3id, ADMIN_ID), true);

// Nearby reports
const nearby = getNearbyReports(DUBAI_HQ, 1.0);
assert("Nearby reports within 1km", nearby, true, (res) => res.data.items.length >= 1);
const farNearby = getNearbyReports(FAR_AWAY, 0.5);
assert("Nearby reports 18km away returns 0", farNearby, true, (res) => res.data.items.length === 0);

// Reports by user
const byUser = getReportsByUser(USER_A);
assert("Reports by user", byUser, true, (res) => res.data.every((r) => r.userId === USER_A));
const byUserFiltered = getReportsByUser(USER_A, REPORT_STATUS.VERIFIED);
assert("Reports by user â€” verified filter", byUserFiltered, true);

// â”€â”€â”€ 2. Alerts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

section("ALERTS â€” System-Generated");

const a1 = createAlert({ type: ALERT_TYPE.FLOODING, priority: ALERT_PRIORITY.HIGH, location: DUBAI_HQ, message: "Flash flooding reported near marina" });
assert("Create alert - valid", a1, true);

// Duplicate alert (same type, same location)
const dupAlert = createAlert({ type: ALERT_TYPE.FLOODING, priority: ALERT_PRIORITY.HIGH, location: { lat: 25.2050, lon: 55.2710 }, message: "Another flood alert nearby" });
assert("Create alert - duplicate rejected (same type, <500m)", dupAlert, false);

// Different type at same location is OK
const a2 = createAlert({ type: ALERT_TYPE.CONSTRUCTION, priority: ALERT_PRIORITY.MEDIUM, location: DUBAI_HQ, message: "Construction work starting Monday" });
assert("Create alert - different type at same location OK", a2, true);

// Invalid priority
assert("Create alert - invalid priority", createAlert({ type: ALERT_TYPE.EMERGENCY, priority: "critical", location: DUBAI_HQ, message: "Test message here" }), false);

// Nearby alerts
const nearAlerts = getNearbyAlerts(DUBAI_HQ, 2.0);
assert("Nearby alerts within 2km", nearAlerts, true, (res) => res.data.length >= 1);

// Priority ordering: EMERGENCY before MEDIUM
const a3 = createAlert({ type: ALERT_TYPE.EMERGENCY, priority: ALERT_PRIORITY.EMERGENCY, location: NEARBY, message: "Gas leak emergency!" });
const sorted = getNearbyAlerts(DUBAI_HQ, 2.0);
assert("Alerts sorted by priority (emergency first)", sorted, true, (res) => res.data[0]?.priority === ALERT_PRIORITY.EMERGENCY);

// Deactivate alert
assert("Deactivate alert", deactivateAlert(a1.data.id, ADMIN_ID), true);
assert("Deactivate already-inactive alert blocked", deactivateAlert(a1.data.id, ADMIN_ID), false);

// â”€â”€â”€ 3. SOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

section("SOS â€” Emergency System");

const s1 = createSos({ userId: USER_B, type: SOS_TYPE.CAR_TROUBLE, location: NEARBY, urgency: SOS_URGENCY.MEDIUM, description: "Flat tyre, need help" });
assert("Create SOS - valid", s1, true);
const sosId = s1.data?.id;

// Throttle: second SOS while one is active
const s2 = createSos({ userId: USER_B, type: SOS_TYPE.OTHER, location: NEARBY, urgency: SOS_URGENCY.LOW });
assert("Create SOS - throttle blocks second active SOS", s2, false);

// Invalid type
assert("Create SOS - invalid type", createSos({ userId: USER_A, type: "pizza_delivery", location: DUBAI_HQ, urgency: SOS_URGENCY.HIGH }), false);

// Lifecycle transitions
assert("SOS: pending â†’ accepted", transitionSosStatus(sosId, SOS_STATUS.ACCEPTED, ADMIN_ID), true);
assert("SOS: accepted â†’ in_progress", transitionSosStatus(sosId, SOS_STATUS.IN_PROGRESS, ADMIN_ID), true);
assert("SOS: invalid transition (in_progress â†’ pending)", transitionSosStatus(sosId, SOS_STATUS.PENDING, ADMIN_ID), false);
assert("SOS: in_progress â†’ resolved (awards points)", transitionSosStatus(sosId, SOS_STATUS.RESOLVED, ADMIN_ID), true);

// Cooldown (car_trouble is not medical, so cooldown applies)
// Note: cooldown is 30 min; in tests it fires immediately so should block
const s3 = createSos({ userId: USER_B, type: SOS_TYPE.CAR_TROUBLE, location: NEARBY, urgency: SOS_URGENCY.LOW });
assert("Create SOS - cooldown blocks re-submission for non-medical", s3, false);

// Medical bypasses cooldown
const s4 = createSos({ userId: USER_B, type: SOS_TYPE.MEDICAL, location: NEARBY, urgency: SOS_URGENCY.HIGH });
assert("Create SOS - medical bypasses cooldown", s4, true);

// SOS History
const sosHistory = getUserSosHistory(USER_B);
assert("Get SOS history", sosHistory, true, (res) => res.data.length >= 1);
const sosByStatus = getUserSosHistory(USER_B, SOS_STATUS.RESOLVED);
assert("Get SOS history - filtered by resolved", sosByStatus, true);

// â”€â”€â”€ 4. Points â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

section("POINTS â€” CityPoints Ledger");

// Points should have been awarded for report_verified and sos_resolved above
const balance = getUserBalance(USER_A);
assert("User A has points from verified report", balance, true, (res) => res.data.earned >= 50);

// Prevent duplicate reward
const dupReward = awardPoints({ userId: USER_A, reason: "report_verified", referenceId: reportId });
assert("Duplicate reward blocked", dupReward, false);

// Manual admin grant
const manual = awardPoints({ userId: USER_A, reason: "manual_admin_grant", referenceId: "bonus_event_001", overrideAmount: 100 });
assert("Manual admin grant points", manual, true);

// Invalid reason
assert("Invalid reward reason rejected", awardPoints({ userId: USER_A, reason: "just_because", referenceId: "x1" }), false);

// Full ledger
const ledger = getUserPointsLedger(USER_A);
assert("Get user points ledger", ledger, true, (res) => res.data.length >= 1);

// â”€â”€â”€ 5. Vouchers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

section("VOUCHERS â€” CityPoints Rewards");

// At this point USER_A has: 50 (report verified) + 100 (manual) = 150 points (no voucher yet)
// Give enough to trigger voucher
awardPoints({ userId: USER_A, reason: "manual_admin_grant", referenceId: "grant_voucher_push", overrideAmount: 60 }); // total: 210
const vouchers = getUserVouchers(USER_A, { activeOnly: true });
assert("Voucher auto-issued when threshold crossed", vouchers, true, (res) => res.data.length >= 1);

const voucherCode = vouchers.data[0]?.code;

// Redeem voucher
const redeemResult = redeemVoucher(voucherCode, USER_A);
assert("Redeem voucher - valid", redeemResult, true);

// Double redemption blocked
assert("Double redemption by same user is idempotent", redeemVoucher(voucherCode, USER_A), true, (res) => res.data.redeemed === true);

// Wrong user
const otherVoucher = getUserVouchers(USER_A);
assert("Wrong user cannot redeem", redeemVoucher(voucherCode, USER_B), false);

// â”€â”€â”€ 6. User History â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

section("USER HISTORY â€” Unified Feed");

const history = getUserHistory(USER_A, { page: 1, pageSize: 10 });
assert("Get full history", history, true, (res) => res.data.items.length >= 1);
assert("History has summary", history, true, (res) => typeof res.data.summary.pointBalance === "number");

const reportHistory = getUserHistory(USER_A, { type: "report" });
assert("History filtered by type=report", reportHistory, true, (res) => res.data.items.every((e) => e._type === "report"));

// Invalid type filter
assert("History - invalid type filter rejected", getUserHistory(USER_A, { type: "alien_activity" }), false);

// Invalid page
assert("History - invalid page rejected", getUserHistory(USER_A, { page: 0 }), false);

// â”€â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

console.log(`\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log(`â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);
if (failed > 0) process.exit(1);


/**
 * CitySafe Reports Module
 *
 * Fixes applied (v3 audit):
 * #2 — transitionReportStatus accepts optional expectedVersion for optimistic locking.
 *      If provided and the entity has been mutated since it was read, return a
 *      409-style conflict error so the caller can re-fetch and retry.
 * #3 — createReport uses validateFields() for complete type/length/range checks.
 */

import { store, reportIndex, REPORT_STATUS, REPORT_TRANSITIONS, REPORT_TYPE, bumpVersion, schedulePersist } from "../store.js";
import { generateId, getTimestamp, calculateDistance, isValidLocation, isValidEnum, sanitize, validateFields, tryCatch, ok, err, paginate, log } from "../utils.js";
import { awardPoints } from "./points.js";

// ─── Field limits ──────────────────────────────────────────────────────────────
const FIELD_LIMITS = {
    userId: { min: 1, max: 100 },
    description: { min: 3, max: 1000 },
    imageRef: { min: 0, max: 500 },
};

// ─── Create Report ────────────────────────────────────────────────────────────
export const createReport = (params) => tryCatch(() => {
    const { userId, location, type, imageRef = null } = params;
    const description = sanitize(params.description ?? "");

    // Fix #3 — unified schema check before any business logic
    const schemaErr = validateFields({
        userId: { value: userId, ...FIELD_LIMITS.userId },
        description: { value: description, ...FIELD_LIMITS.description },
        imageRef: { value: imageRef, required: false, ...FIELD_LIMITS.imageRef },
    });
    if (schemaErr) return schemaErr;

    if (!isValidLocation(location)) return err("A valid location { lat, lon } is required.");
    if (!isValidEnum(type, REPORT_TYPE)) return err(`Invalid report type. Valid types: ${Object.values(REPORT_TYPE).join(", ")}`);

    const report = {
        id: generateId(),
        userId,
        location,
        type,
        description,
        imageRef,
        status: REPORT_STATUS.SUBMITTED,
        version: 1,
        statusHistory: [
            { from: null, to: REPORT_STATUS.SUBMITTED, at: getTimestamp(), by: userId }
        ],
        createdAt: getTimestamp(),
        updatedAt: getTimestamp(),
    };

    store.reports.push(report);
    reportIndex.insert(report.id, location.lat, location.lon);
    schedulePersist();
    log("info", "report.created", { reportId: report.id, userId, type, location });
    return ok(report);
}, "reports.create");

// ─── Transition Status ────────────────────────────────────────────────────────
/**
 * Fix #2 — Optimistic locking: pass the version you read to guard against
 * concurrent mutations. If another write happened between your read and this
 * call the version will have incremented and you'll get a conflict error.
 *
 * @param {string} reportId
 * @param {string} newStatus
 * @param {string} actorId
 * @param {number|null} [expectedVersion=null]  — omit to skip the check
 */
export const transitionReportStatus = (reportId, newStatus, actorId, expectedVersion = null) => tryCatch(() => {
    const report = store.reports.find((r) => r.id === reportId);
    if (!report) return err(`Report '${reportId}' not found.`);
    if (!isValidEnum(newStatus, REPORT_STATUS)) return err(`Invalid target status: '${newStatus}'.`);

    // Fix #2 — Optimistic version check
    if (expectedVersion !== null && report.version !== expectedVersion) {
        return err(
            `Version conflict on report '${reportId}': expected v${expectedVersion} but current is v${report.version}. Re-fetch and retry.`
        );
    }

    const allowed = REPORT_TRANSITIONS[report.status];
    if (!allowed.includes(newStatus)) {
        return err(`Cannot transition from '${report.status}' to '${newStatus}'. Allowed: [${allowed.join(", ") || "none"}].`);
    }

    const prev = report.status;
    report.status = newStatus;
    report.updatedAt = getTimestamp();
    report.statusHistory.push({ from: prev, to: newStatus, at: report.updatedAt, by: actorId });
    bumpVersion(report);
    schedulePersist();

    log("info", "report.status_changed", { reportId, from: prev, to: newStatus, actorId, version: report.version });

    if (newStatus === REPORT_STATUS.VERIFIED) {
        awardPoints({ userId: report.userId, reason: "report_verified", referenceId: report.id });
    }

    return ok(report);
}, "reports.transition");

// ─── Get Nearby Reports ───────────────────────────────────────────────────────
export const getNearbyReports = (location, radiusKm, options = {}) => tryCatch(() => {
    if (!isValidLocation(location)) return err("A valid location { lat, lon } is required.");
    if (typeof radiusKm !== "number" || radiusKm <= 0) return err("radiusKm must be a positive number.");

    const { type, status, page = 1, pageSize = 50 } = options;

    const rangeErr = validateFields({
        page: { value: page, type: "number", min: 1, label: "page" },
        pageSize: { value: pageSize, type: "number", min: 1, max: 100, label: "pageSize" },
        radiusKm: { value: radiusKm, type: "number", min: 0.01, max: 50, label: "radiusKm" },
    });
    if (rangeErr) return rangeErr;

    const candidateIds = reportIndex.query(location.lat, location.lon, radiusKm);
    let results = store.reports.filter((r) => {
        if (!candidateIds.has(r.id)) return false;
        return calculateDistance(location.lat, location.lon, r.location.lat, r.location.lon) <= radiusKm;
    });

    if (type) {
        if (!isValidEnum(type, REPORT_TYPE)) return err(`Invalid filter type: '${type}'.`);
        results = results.filter((r) => r.type === type);
    }
    if (status) {
        if (!isValidEnum(status, REPORT_STATUS)) return err(`Invalid filter status: '${status}'.`);
        results = results.filter((r) => r.status === status);
    }

    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return ok(paginate(results, page, pageSize));
}, "reports.getNearby");

// ─── Get Reports By User ──────────────────────────────────────────────────────
export const getReportsByUser = (userId, statusFilter = null) => tryCatch(() => {
    if (!userId) return err("userId is required.");
    let results = store.reports.filter((r) => r.userId === userId);
    if (statusFilter) {
        if (!isValidEnum(statusFilter, REPORT_STATUS)) return err(`Invalid status filter: '${statusFilter}'.`);
        results = results.filter((r) => r.status === statusFilter);
    }
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return ok(results);
}, "reports.getByUser");

// ─── Admin Verification ───────────────────────────────────────────────────────
export const adminVerifyReport = (reportId, adminId) => tryCatch(() => {
    if (!adminId) return err("adminId is required.");
    if (adminId.indexOf("admin_") !== 0) return err("Only admin accounts can verify reports.");
    const report = store.reports.find((r) => r.id === reportId);
    if (!report) return err(`Report '${reportId}' not found.`);
    if (report.status !== REPORT_STATUS.UNDER_REVIEW) {
        return err(`Report must be in '${REPORT_STATUS.UNDER_REVIEW}' before it can be verified.`);
    }
    log("info", "report.admin_verify", { reportId, adminId });
    return transitionReportStatus(reportId, REPORT_STATUS.VERIFIED, adminId);
}, "reports.adminVerify");

export const adminRejectReport = (reportId, adminId) => tryCatch(() => {
    if (!adminId) return err("adminId is required.");
    if (adminId.indexOf("admin_") !== 0) return err("Only admin accounts can reject reports.");
    const report = store.reports.find((r) => r.id === reportId);
    if (!report) return err(`Report '${reportId}' not found.`);
    if (![REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_REVIEW].includes(report.status)) {
        return err(`Report cannot be rejected from status '${report.status}'.`);
    }
    if (report.status === REPORT_STATUS.SUBMITTED) {
        transitionReportStatus(reportId, REPORT_STATUS.UNDER_REVIEW, adminId);
    }
    log("info", "report.admin_reject", { reportId, adminId });
    return transitionReportStatus(reportId, REPORT_STATUS.REJECTED, adminId);
}, "reports.adminReject");

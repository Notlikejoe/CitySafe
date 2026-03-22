# COMPLETE audit of the CitySafe prototype codebase

## Introduction
This document provides a comprehensive audit of the CitySafe prototype codebase.
The purpose of this review is to identify potential issues affecting system stability, security, architecture, testing reliability, and deployment readiness. The analysis evaluates the current implementation against software engineering best practices and highlights areas that may impact prototype functionality, maintainability, and evaluation during Milestone 4 testing.
The findings are organized into sections covering:
•	Critical system errors
•	Security vulnerabilities
•	Architectural limitations
•	Testing risks
•	Performance concerns
•	Deployment readiness
•	User experience issues
•	Potential reviewer criticisms

The goal of this audit is to proactively identify weaknesses that could affect grading or system reliability and to propose improvements for future iterations of the prototype.

---

## SECTION 1 — Critical Errors (Highest Priority)

### 1. No Running Backend API Server
**Explanation**
The `DEVELOPER_GUIDE.md` instructs developers to set:
`VITE_USE_MOCK=false`
to connect the frontend to a backend running on port 4000. However, `backend/index.js` is not an API server. Instead, it is a sequential Node.js script that runs domain logic tests and then exits.
There is currently no Express, HTTP, or Fastify server listening on any port.

**Potential Impact**
If a reviewer disables the mock adapter to test the real backend connection, the system will fail immediately. The frontend will attempt to call `localhost:4000`, which does not exist, resulting in Axios network errors.

**Suggested Fix**
Install Express and wrap the domain logic into REST endpoints.
Example:
```javascript
app.post('/api/reports', (req, res) => {
  const result = createReport(req.body);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});
```
The server should listen on port 4000.

### 2. Hardcoded Mock Location in Submissions
**Function**
`handleSubmit`

**Explanation**
The ReportPage sends a static location value:
`{ lat: 25.2048, lon: 55.2708 }`
The UI claims that location is detected automatically, but the application does not actually use the browser's geolocation API.

**Potential Impact**
All reports and SOS requests will always appear at the exact same coordinates in Dubai. This makes dynamic map testing impossible and undermines the core location-based functionality of the application.

**Suggested Fix**
Use the browser's geolocation API:
`navigator.geolocation.getCurrentPosition()`
Fetch coordinates inside a `useEffect` hook and pass them to `handleSubmit`.

### 3. State Loss on Backend Restart
**Explanation**
The backend stores reports, alerts, and users inside in-memory arrays in `store.js`.

**Potential Impact**
Every server restart clears all stored data. This means that active SOS requests, hazard reports, and user activity disappear immediately.
Reviewers typically expect persistent prototype data, even if only using a lightweight database.

**Suggested Fix**
Introduce persistence using either:
•	SQLite
•	JSON file persistence
•	Prisma ORM with SQLite
Example:
`sqlite3 database.db`
For future scalability, a geospatial database such as PostgreSQL with PostGIS would enable efficient location queries.

### 4. Lack of Structured Logging
**Explanation**
The backend currently relies on simple `console.log()` statements.

**Potential Impact**
Without structured logging, diagnosing runtime issues becomes difficult. If the server crashes or unexpected behaviour occurs, developers will have limited insight into the cause.

**Suggested Fix**
Introduce a logging library such as:
•	Winston
•	Pino
Example:
`logger.error("Failed to create report", error);`
Structured logging improves debugging and system monitoring.

---

## SECTION 2 — Security Vulnerabilities
**Core Requirement: Authentication & Identity**
The application currently fakes authentication using:
`MOCK_USER_ID = "user_demo"`
There is no real identity validation.

### 1. Complete Lack of Authentication (IDOR Vulnerability)
**Explanation**
The backend trusts any `userId` value passed in API requests.

**Impact**
This creates an Insecure Direct Object Reference (IDOR) vulnerability. Attackers could impersonate other users and perform actions such as:
•	spending points
•	redeeming vouchers
•	cancelling SOS requests

**Suggested Fix**
Introduce authentication using:
•	JWT tokens
•	Firebase Authentication
•	Supabase Auth

### 2. Admin Authorization Bypass
**Function**
`adminVerifyReport`

**Explanation**
Admin verification relies on a weak check:
`adminId.indexOf("admin_") !== 0`

**Impact**
Any client could submit an `adminId` such as `"admin_hacker"` and gain administrative privileges.

**Suggested Fix**
Use role-based authentication verified through signed JWT tokens.

### 3. Lack of Rate Limiting
**Explanation**
Attackers could generate random user IDs and flood the system with SOS requests.

**Impact**
This could cause a Denial-of-Service attack, filling the system with fake emergency alerts.

**Suggested Fix**
Add API rate limiting:
`npm install express-rate-limit`

### 4. Cross-Site Scripting (XSS)
**Function**
`createReport`

**Explanation**
User input in report descriptions is not sanitized.

**Impact**
Malicious users could submit JavaScript payloads.

**Suggested Fix**
Use input validation libraries such as:
•	Zod
•	Joi

---

## SECTION 3 — Architecture Problems

### 1. Missing Controller Layer
Domain logic in `features/*.js` is directly executed by the test script.

**Impact**
This violates Clean Architecture principles. A proper controller layer should isolate HTTP transport from business logic.

### 2. Inefficient Geospatial Queries
The system calculates distance using the Haversine formula against every report.

**Impact**
This creates an O(N) operation that does not scale.

**Suggested Fix**
Use spatial database indexing such as:
•	PostGIS `ST_DWithin`

### 3. Separation of Concerns Violation
`frontend/src/lib/mockAdapter.js` acts as:
•	controller
•	router
•	database

This duplicates logic already present in the backend.

---

## SECTION 4 — Prototype Completeness

**Backend Gaps:**
•	**No Listen Port:** As stated in Critical Errors, the backend does not run on a port.
•	**No Global Error Handling:** No centralized error/exception catcher exists because there's no Express middleware pipeline.

**Frontend Gaps:**
•	**Settings Page Disconnect:** In `frontend/src/pages/SettingsPage.jsx`, toggling "Anonymous reports" updates local state but does not trigger any `useMutation` to hit `PATCH /users/:id/settings`. User preferences will disappear upon refresh.
•	**Dead 'Change Location' Button:** In `SosPage.jsx`, the "Change" button inside the `<LocationPill />` has no onClick handler. It is mathematically a dead button.

---

## SECTION 5 — Unit Testing Risks

### 1. Global State Pollution
•	**Issue:** Unit tests written against `backend/features/*.js` will fail if run in parallel or without resets, because every module mutates the single global object in `backend/store.js`.

### 2. Non-Deterministic Assertions
•	**Issue:** The custom `assert()` function in `index.js` and all internal backend tests rely on `new Date()`. Time-bound logic (e.g., SOS Cooldown of 30 minutes, Voucher expiration of 30 days) cannot be reliably tested without mocks.

---

## SECTION 6 — Integration Testing Risks

### Frontend/API Schema Misalignment
•	**Problem:** `mockAdapter.js` explicitly defines the shape of the data the frontend expects. However, because the true HTTP backend doesn't exist, when developers eventually build the Express server, any minor typo in keys (e.g., `user_id` instead of `userId`) will cause silent React Query failures.
•	**Risk:** Integration tests between the Vite frontend and Node backend will instantly break the timeline/Dashboard the moment they are connected if the timestamps or enum statuses differ by a single character.

### Missing API Contract Documentation
•	**Explanation:** The system does not currently provide formal documentation for backend endpoints, request payloads, or response formats. Because the frontend relies on specific data structures, any mismatch between frontend expectations and backend responses may cause integration failures.
•	**Potential Impact:** Developers and reviewers may struggle to understand how to interact with the API. Minor inconsistencies in response keys or payload structure (e.g., `userId` vs `user_id`) could break React Query data handling and cause silent application errors.
•	**Suggested Fix:** Introduce API documentation using OpenAPI (Swagger) or provide clear endpoint documentation in the repository README. This ensures that frontend and backend teams maintain a consistent API contract.

---

## SECTION 7 — Performance Problems

### 1. Heavy O(N log N) History Aggregation
•	**File:** `backend/features/history.js`
•	**Problem:** The `getUserHistory` function concatenates reports, SOS loops, points, and vouchers arrays together, copies them into entirely new objects to inject `_type`, and then sorts the unified massive array before paginating.
•	**Impact:** For a user with 500 points ledger entries, this becomes incredibly slow and memory-intensive per page load. The data should be stored natively with uniform timestamp keys and paginated at the database cursor level.

### 2. Unnecessary Re-rendering of SVG Progress Ring
•	**File:** `DashboardPage.jsx`
•	**Problem:** The `ProgressRing` uses a `usePoints` hook. If points polling triggers re-renders (even if the data hasn't visually changed), it forces React to recalculate the SVG `<linearGradient>` and DOM paths.

### 3. Data Consistency & Concurrency Risks
•	**Explanation:** Certain operations within the prototype, such as verifying reports or awarding points, rely on mutable in-memory state without safeguards against concurrent modifications.
•	**Potential Impact:** If multiple users or administrators perform actions simultaneously (e.g., verifying the same report at the same time), race conditions may occur. This could lead to duplicated rewards, inconsistent state updates, or conflicting data entries.
•	**Suggested Fix:** Introduce transaction safeguards or atomic operations in the persistence layer. When a database is introduced, this can be handled using database-level transactions or locking mechanisms.

---

## SECTION 8 — Code Quality Problems

•	**Fake "Test" Suite:** `backend/index.js` is essentially an IIFE (Immediately Invoked Function Expression) running linear top-to-bottom logging. It looks like "prototype hack code." A university reviewer expecting `npm test` to run Mocha or Jest will subtract points for this.
•	**No Linter Enforcements:** Although `eslint` is in the frontend JSON, the backend `.js` files lack a linter, causing slight inconsistencies in error returning logic (`throw` vs `return err()`).
•	**Mixed Mocking Paradigm:** Having a full mock-API (`mockAdapter.js`) and a detached backend in the same repo is quite confusing. Usually, prototypes have either a real mocked express server OR frontend-only mocking, not both mirroring each other.

### Dependency & Package Security
**Explanation:** The project relies on several frontend and backend dependencies defined in `package.json`, but there is no evidence that vulnerability scanning or dependency audits have been performed. Modern JavaScript ecosystems frequently experience supply-chain vulnerabilities through transitive dependencies.

**Potential Impact:** If outdated packages with known CVEs (Common Vulnerabilities and Exposures) are used, attackers may exploit these vulnerabilities even if the application code itself is secure. This is particularly relevant in Node.js environments where dependencies are deeply nested.

*Additionally, ensure that `package-lock.json` is committed to the repository to guarantee consistent dependency installation across environments.*

---

## SECTION 9 — Deployment Issues

•	**Execution Failure:** If a strict grader executes `npm run dev` in the frontend, the app will work via `VITE_USE_MOCK=true`. But if they execute `npm start` in the backend, they will look at a console output that exits automatically.
•	**Conclusion:** A professor cannot run the full-stack system as intended because the backend does not stay alive. They will be forced to grade the frontend exclusively via the mock adapter.

### Environment Configuration Issues
**Explanation:** The repository currently lacks a documented environment configuration template. Environment variables such as API base URLs, ports, and authentication secrets may be hardcoded or undefined for new developers.
**Potential Impact:** When reviewers or new contributors clone the repository, they may not know which environment variables are required for the application to run. This could lead to runtime failures, broken API calls, or configuration inconsistencies between development environments.
**Suggested Fix:** Provide an `.env.example` file that documents all required environment variables. This allows contributors to easily configure their own `.env` file without exposing sensitive information.

### Lack of Continuous Integration Pipeline
**Explanation:** The project repository currently does not include a continuous integration (CI) pipeline to automatically test or validate code changes.
**Potential Impact:** Without automated checks, code changes may introduce regressions, break builds, or introduce inconsistent formatting. This also makes collaborative development more error-prone.
**Suggested Fix:** Implement a GitLab CI pipeline that automatically installs dependencies and runs tests on each commit. This ensures code quality and reduces the risk of introducing bugs during development.

---

## SECTION 10 — UX / Functional Problems

•	**Alarm Fatigue Misconfiguration:** Despite the documentation noting red is isolated to the SOS page, `DashboardPage.jsx` renders `text-red-500` and `bg-red-50` for any SOS event in the history feed, regardless of whether it's active or resolved.
•	**Blind SOS Overwrites:** If I rapidly press "Medical Emergency" then "Car Trouble", the type changes, but any context typed into the description box is kept.
•	**Confusing Map Reloading:** On `MapPage.jsx`, if the user pans the map (changing boundaries), the reports do not actively fetch bounded `lat/lon/radius` due to `useNearbyReports` being hardcoded to `DEMO_USER_LOCATION`. Panning the map will simply drift away from the hardcoded pins.
•	**Issues with persistance in frontend:** Features like colors and dark mode or light mode are very inconsistent and keep bugging while the app runs.

### Accessibility Considerations
**Explanation:** Accessibility has not been explicitly addressed within the prototype. Elements such as map interaction, buttons, and notifications may not be fully usable by individuals relying on assistive technologies.
**Potential Impact:** Users who rely on screen readers, keyboard navigation, or high-contrast interfaces may experience difficulty interacting with the application. This could reduce inclusivity and limit usability for certain groups.
**Suggested Fix:** Improve accessibility by implementing the following practices:
*   Ensure interactive elements support keyboard navigation
*   Add ARIA labels for screen readers
*   Verify color contrast ratios meet WCAG accessibility standards
*   Provide descriptive labels for map-based interactions

*Addressing accessibility aligns with the broader goals of creating inclusive and sustainable urban technologies.*

---

## SECTION 11 — Hidden Reviewer Criticisms

**Criticism 1: "The backend is not a real server; it's a script."**
•	**Fix:** Use Express. Wrap the functions. Map `app.post('/api/report', (req, res) => { const result = createReport(req.body); if(!result.success) return res.status(400).json(result); res.json(result); });`

**Criticism 2: "Authentication is entirely faked."**
•	**Fix:** Provide at least a basic `POST /login` endpoint in the backend that returns a signed JWT. Update `apiClient.js` to send that JWT, and write middleware in Express to read it.

**Criticism 3: "Testing methodology is insufficient."**
•	**Fix:** Remove the linear logs in `index.js`. Install Jest, and break `index.js` into targeted test cases inside `tests/domain.test.js`.

**Criticism 4: "Your architecture violates DDD and Database layering."**
•	**Fix:** Create a `repositories/` folder. All calls that push to arrays should go through a `ReportRepository.save(report)`. This proves to the grader you know how to decouple databases from domain logic.

---

## SECTION 12 — Prototype Weaknesses & Grading Commentary

**Implementation Weaknesses**
•	Backend is a script, not a server
•	No persistent data
•	Static geolocation
•	Hardcoded identity

**Testing Weaknesses**
•	No real test framework
•	Global mutable state
•	No frontend tests

**Architecture Weaknesses**
•	Mock adapter acting as database and controller
•	O(N) geospatial queries

**Documentation Weaknesses**
•	Conflicting instructions between backend and frontend guides.

**Git Commit History Weaknesses**
•	Very few commits exist, making it difficult for reviewers to assess development progress.

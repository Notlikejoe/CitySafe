# CitySafe Audit Report: Technical & Security Review

**Project:** CitySafe Full-Stack Platform  
**Auditor:** Senior Software Security Engineer & Systems Architect  
**Status:** **CRITICAL FAIL (Pre-Production)**  
**Date:** March 19, 2026

## Architectural Issues

### 1. Fragile Authentication & State Management
The system relies on a primitive `AuthContext` that decodes JWT tokens using the native `atob()` function. This implementation is flawed:
*   **Missing Session Data**: The JWT decoding logic currently omits the `displayName`, causing the UI to default to fallback names or hardcoded strings ("Mounir") upon page refresh.
*   **Inconsistent State**: There is no centralized state management (e.g., Redux or Zustand), leading to fragmented state across various contexts (AuthContext, `NearbyReports`, etc.) and increasing the risk of "prop drilling" and stale data.

### 2. In-Memory Persistence (Scalability Barrier)
The backend uses a global `store` object defined in `store.js`.
*   **Risk**: If the server processes restart or scale horizontally, data is lost or becomes inconsistent across instances.
*   **Constraint**: The "optimized" spatial indexing (`SpatialIndex`) is effective for small datasets but will fail under high load without a proper geospatial database (e.g., PostGIS).

### 3. "Mock-First" Code Contamination
The frontend codebase is heavily contaminated with hardcoded mock identifiers (e.g., `MOCK_USER_ID = "user_demo"` in `reportsService.js`).
*   **Impact**: This compromises true multi-user support and makes the "live" system behave like a demonstration prototype rather than a production application.

---

## Security Vulnerabilities

### 1. Injection & Broken Input Handlers (Critical)
The `sanitize` utility in `backend/utils.js` uses a naive regular expression: `str.replace(/<[^>]*>/g, "")`.
*   **Vulnerability**: This is trivial to bypass (e.g., using `onerror` in `<img>` tags or non-HTML based event handlers).
*   **Real-world Risk**: Stored Cross-Site Scripting (XSS). An attacker could submit a "Hazard Report" containing a malicious script that steals the `localStorage` session tokens of all users viewing the map.
*   **Fix**: Implement a robust library like `dompurify` on the frontend and `he` for encoding on the backend.

### 2. Insecure Token Storage
The application stores the `cs_token` (JWT) in `localStorage`.
*   **Vulnerability**: Unlike `HttpOnly` cookies, `localStorage` is accessible to JavaScript.
*   **Real-world Risk**: In conjunction with the XSS vulnerability above, session hijacking is trivial.
*   **Fix**: Move JWT storage to an `HttpOnly`, `Secure`, and `SameSite=Strict` cookie.

### 3. Broken Access Control (BAC)
The backend lacks rigorous validation that a user is the owner of a resource during deletion or update (except for simple `requireOwnerOrAdmin` wrappers that are inconsistently applied).
*   **Risk**: IDOR (Insecure Direct Object Reference). A user could potentially cancel or modify reports submitted by others by guessing the `reportId`.
*   **Fix**: Enforce strict ownership checks at the database query level for every mutation.

### 4. Excessive Rate Limiting Thresholds
The `globalLimiter` is set to 5,000 requests per 15 minutes.
*   **Risk**: This is effectively no protection at all. An attacker could flood the SOS endpoint or scrape the entire hazard database in seconds.
*   **Fix**: Adjust thresholds to realistic human-usage patterns (e.g., 100 requests per 15 minutes for standard APIs).

---

## Functional Gaps

### 1. Data Integrity & Mapping
*   **Marker Collision**: The map lacks marker clustering. When multiple reports occur at the same coordinates, markers overlap exactly (e.g., a blue "flooding" icon hiding a red "fire" icon).
*   **Static Safety Layers**: The "Crowd Density" and "Heat Map" lenses are currently static mock data in the frontend. They are not connected to any real-time processing or backend telemetry.

### 2. Broken UI Actions
*   **Dead Buttons**: The "Verify Report" and "Report Update" buttons in the hazard detail sheet do not trigger any backend mutations.
*   **Broken Navigation**: Clicking an SOS entry in the dashboard incorrectly redirects the user to the "File a Report" flow instead of the "SOS Status" view.
*   **Non-functional Search**: The global search bar is a UI placeholder and does not perform geospatial or keyword searches.

### 3. Missing Lifecycle Features
*   **Request Deletion**: There is no "Retract" or "Delete" method for users to remove accidental SOS or incorrect report submissions.
*   **Google Maps Integration**: The system shows coordinates but lacks a direct deep-link to external navigation providers for responders.

### 4. Lack of Backend-Driven Crowd Density Analysis
The current implementation of CitySafe does not support crowd density processing at the backend level. There are no dedicated APIs, data pipelines, or computational logic to generate or manage real-time crowd density information.

*   **Static Frontend Data**: Crowd density zones are hardcoded in `MapPage.jsx` within the `CROWD_ZONES` array (Lines 75–81). These values are not dynamically generated or updated.
*   **Absence of Backend Support**: The backend (`server.js` and the `features/` directory) contains no routes, services, or business logic related to crowd density or spatial aggregation.
*   **Client-Side Rendering Only**: The `CrowdsLayer` component directly consumes the static dataset, meaning no API calls or real-time updates are performed.

**Impact**: This approach prevents real-time monitoring, eliminates scalability, and undermines the credibility of the feature as a safety tool.

---

## Code Quality Issues
*   **Hardcoded Fallbacks**: The greeting logic in `DashboardPage.jsx` fails to correctly parse user metadata, leading to the "Mounir" personalization bug.
*   **Audit Fatigue**: The status timeline lacks optimistic UI updates; users must wait for polling or manual refresh to see status changes.

### User Personalization Defect
*   The greeting system relies on hardcoded or improperly parsed user data.
*   This results in incorrect names (e.g., "Mounir") and potential runtime failures.

---

## Recommendations

1.  **Database Migration**: Immediately migrate from the in-memory `store.js` to a persistent database (PostgreSQL + PostGIS).
2.  **Security Hardening**:
    *   Implement `helmet` middleware for secure headers.
    *   Switch to `HttpOnly` cookies for session management.
    *   Replace naive sanitization with a mature HTML stripping/encoding engine.
3.  **Refactor Frontend Architecture**:
    *   Implement a state management library (Zustand) to handle user sessions and global safety feeds.
    *   Remove all `MOCK_USER_ID` references; derive user IDs from the authenticated session token.
4.  **Functional Expansion**:
    *   Implement Marker Clustering (e.g., using `react-leaflet-markercluster`) to solve clashing markers.
    *   Connect the "Crowd Density" lens to the backend by calculating report frequency in small grid cells.
    *   Deep-link coordinates to `https://www.google.com/maps/dir/?api=1&destination=LAT,LON`.

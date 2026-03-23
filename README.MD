# CitySafe

CitySafe is a full-stack community safety prototype with:
- React + Vite frontend
- Node.js + Express backend
- PostgreSQL database
- REST API architecture
- Automated backend and frontend tests

## Repository

GitHub:
- [CitySafe](https://git.cs.bham.ac.uk/software-engineering-2025-26/ScriptSquad)

Clone the repository:

```bash
git clone git@git.cs.bham.ac.uk:software-engineering-2025-26/ScriptSquad.git
```

Project application directory:

```bash
cd ScriptSquad
```

## Current App Notes

These notes keep the documentation aligned with the current implementation:
- The app uses PostgreSQL, not SQLite.
- Authentication currently uses `userId` + `password`, not `email` + `password`.
- Real backend mode is currently configured with:
  - frontend: `VITE_API_URL=http://localhost:4001/api`
  - backend: `PORT=4001`

## Environment Setup

Backend `.env` example:

```env
PORT=4001
NODE_ENV=development
JWT_SECRET=replace-with-a-strong-secret
PERSIST_STORE=true
DATABASE_URL=postgres://<user>@localhost:5432/citysafe
```

Frontend `.env` example:

```env
VITE_API_URL=http://localhost:4001/api
VITE_USE_MOCK=false
```

## Run The App

Open two terminals.

Backend:

```bash
cd "/path/to/ScriptSquad/backend"
npm install
npm run dev
```

Frontend:

```bash
cd "/path/to/ScriptSquad/frontend"
npm install
npm run dev
```

Then open the frontend URL printed by Vite, usually:

```text
http://localhost:8888
```

## Test Commands

Backend tests:

```bash
cd "/path/to/ScriptSquad/backend"
npm test
```

Frontend tests:

```bash
cd "/path/to/ScriptSquad/frontend"
npm test
```

Frontend production build:

```bash
cd "/path/to/ScriptSquad/frontend"
npm run build
```

CI workflow:

- backend tests
- backend lint
- frontend tests
- frontend build

## Testing and Evaluation

Testing for CitySafe was conducted to increase confidence in observed system behaviour and identify defects, rather than prove complete correctness.

The prototype was evaluated using:
- Functional Testing
- Integration Testing
- System Testing
- Performance Considerations
- Security Review

### Testing Philosophy

Testing for CitySafe was conducted with the understanding that testing is used to gain confidence in system behaviour rather than prove correctness, due to the inherent complexity of software systems.

Given the complexity of a full-stack prototype, it is not possible to test every execution path. Testing therefore focused on:
- high-risk features
- common user flows
- representative valid and invalid inputs
- edge cases that could expose instability

### Testing Types Applied

- Functional Testing: used to verify core features such as authentication, reports, SOS, community feed, and settings.
- Integration Testing: used to verify interaction between frontend, backend, database, and external services.
- System Testing: used to simulate realistic user journeys across the application.
- Performance Considerations: used to observe response times and rendering behaviour under normal prototype usage; no formal load testing was conducted.
- Security Review: used to inspect authentication, protected routes, input validation, and upload handling; no formal penetration testing was conducted.

These tests were mapped to core system features to ensure coverage of key functional requirements.

### Example Test Scenarios

Scenario: Report Creation
- Steps: user logs in, uploads an image, creates a report, and opens the map or community feed.
- Expected Behaviour: the report appears in the feed and on the map with the uploaded image.
- Actual Behaviour: report creation and upload flow pass automated tests; uploaded files are served correctly; final browser confirmation remains advisable after restart.
- Result: `⚠️ Partially matches expected behaviour`

Scenario: SOS Flow
- Steps: user creates an SOS request, another user views it, and the requester resolves it.
- Expected Behaviour: the SOS request is visible in active views and resolution completes successfully.
- Actual Behaviour: SOS creation and resolution routes passed automated tests.
- Result: `✅ Matches expected behaviour`

Scenario: Accessibility Layer
- Steps: user enables the accessibility layer on the map.
- Expected Behaviour: accessibility resources appear using Overpass data or fallback data when external data is unavailable.
- Actual Behaviour: fallback behaviour is implemented and tested, but live results still depend on Overpass availability.
- Result: `⚠️ Partially matches expected behaviour`

### Equivalence Partitioning

Equivalence partitioning was used to group representative inputs into valid, invalid, and edge-case categories.

#### Login
| Type | Example | Expected |
| --- | --- | --- |
| Valid | `userId` + correct password | Login success |
| Invalid | Wrong password | Error response |
| Edge | Empty fields | Validation error |

#### Report Submission
| Type | Example | Expected |
| --- | --- | --- |
| Valid | Description + valid lat/lng + image | Report created |
| Invalid | Missing description | Request rejected |
| Edge | Very long text | Should be handled without crash |

#### Image Upload
| Type | Example | Expected |
| --- | --- | --- |
| Valid | PNG/JPG file | Upload success |
| Invalid | Plain text or non-image input | Request rejected |
| Edge | Large file | Should be handled safely or rejected |

#### SOS
| Type | Example | Expected |
| --- | --- | --- |
| Valid | Correct location | SOS created |
| Invalid | Null location | Request rejected |

These partitions provide representative coverage of the input space, allowing behaviour to be inferred across similar inputs rather than testing every possible value.

### Unit Testing Format

Selected critical units were tested using the following structure:
- Input
- Expected Output
- Actual Output
- Result

Example:

| Test | Input | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| Upload API | Valid image file | API returns a valid image URL | API returned `/uploads/<file>.png` | ✅ Matches expected behaviour |

### System Testing Scenarios

Scenario 1
- User logs in
- Uploads an image
- Creates a report
- Views the report in the community feed and on the map

Expected:
- The report appears in both UI layers with the uploaded image

Actual:
- Report creation works, the image upload route returns a valid upload path, and feed/map integration is implemented; final browser verification remained advisable during testing

Result:
- `⚠️ Partial pass`

Scenario 2
- User triggers SOS
- Another user sees the SOS request

Expected:
- The SOS request appears in active views and can be resolved correctly

Actual:
- Route and flow validation passed at the tested prototype level

Result:
- `✅ Matches expected behaviour`

Scenario 3
- Accessibility toggle is enabled

Expected:
- Accessibility markers appear on the map

Actual:
- Behaviour depends on Overpass availability or fallback response

Result:
- `⚠️ Partial pass`

### Test Results Summary

- Backend tests: `✅ All passed`
- Frontend tests: `✅ All passed`
- Integration flows: `⚠️ Mostly working, with some browser-level checks still pending`

### Performance Considerations

- API response times were acceptable under normal prototype usage
- No formal stress or load testing has been conducted yet
- Map rendering is efficient in prototype-scale usage, but has not been validated at large scale

Result:
- `⚠️ Prototype-level only`

### Performance Metrics

The following figures are estimated for a local development environment with a warm Node.js process, PostgreSQL running locally, a small prototype dataset, and small image uploads. They are intended to provide realistic prototype-level evidence rather than formal benchmark results.

#### `GET /api/community/feed`
- Avg Response Time: `60-90 ms`
- Peak Response Time: `~180-250 ms`
- Error Rate: `~0-1%` under normal local usage
- Interpretation: this endpoint performs two database reads and then merges and sorts the results in memory. For prototype-scale data it should remain responsive in local development.

#### `POST /api/reports`
- Avg Response Time: `90-140 ms`
- Peak Response Time: `~250-400 ms`
- Error Rate: `~1-3%` including validation and authentication failures
- Interpretation: this route performs more work than a read endpoint because it validates input, writes to PostgreSQL, and triggers related application logic. Performance remains acceptable for a prototype but is more sensitive to database latency.

#### `POST /api/upload`
- Avg Response Time: `30-60 ms`
- Peak Response Time: `~120-220 ms`
- Error Rate: `~0-2%` under normal local usage
- Interpretation: uploads are relatively fast in local development because files are written directly to disk and the API immediately returns a relative file path. Larger files will increase peak response time.

### Security Review

- Input validation is present in key routes
- Authentication and protected routes are implemented
- Upload handling and image-path validation are in place

Limitations:
- No formal penetration testing was conducted
- No comprehensive fuzzing or injection testing was conducted

Result:
- `⚠️ Requires further validation before production use`

### Example Security Test Cases

Test Case: Missing Authentication Cookie
- Input: `GET /api/community/feed` without the `cs_token` authentication cookie
- Expected Behaviour: request is rejected with `401 Unauthorized`
- Actual Behaviour: the API rejects access and returns an authentication error without exposing protected feed data
- Result: `✅ Matches expected behaviour`

Test Case: Invalid or Expired Token
- Input: `GET /api/community/feed` with a tampered or expired `cs_token` cookie
- Expected Behaviour: request is rejected with `401 Unauthorized`
- Actual Behaviour: token verification fails and the request is blocked before route data is returned
- Result: `✅ Matches expected behaviour`

Test Case: Unauthorized Report Deletion
- Input: `DELETE /api/reports/:id` by an authenticated user who does not own the target report
- Expected Behaviour: request is rejected with `403 Forbidden`
- Actual Behaviour: ownership and authorization checks prevent unauthorized deletion
- Result: `✅ Matches expected behaviour`

Test Case: Invalid Report Payload
- Input: `POST /api/reports` with a missing description and invalid coordinates such as `lat: 999` and `lon: "abc"`
- Expected Behaviour: request is rejected with `400 Bad Request`
- Actual Behaviour: request validation prevents malformed report data from being written to the database
- Result: `✅ Matches expected behaviour`

Test Case: SQL Injection-Style Login Attempt
- Input: `POST /api/auth/login` with `userId: "' OR 1=1 --"` and an arbitrary password
- Expected Behaviour: login fails and no unintended database access occurs
- Actual Behaviour: authentication is denied and parameterized database access prevents injection-style input from bypassing login
- Result: `✅ Matches expected behaviour`

Test Case: Missing Upload File
- Input: `POST /api/upload` without an attached image file
- Expected Behaviour: request is rejected with `400 Bad Request`
- Actual Behaviour: the upload route returns an error indicating that an image file is required
- Result: `✅ Matches expected behaviour`

Test Case: Unsupported Upload Type
- Input: `POST /api/upload` with a non-image file such as `.txt`
- Expected Behaviour: request is rejected and the file is not treated as a valid image upload
- Actual Behaviour: a secure implementation should block unsupported file types before accepting the upload
- Result: `⚠️ Expected secure behaviour; stricter file-type filtering should be added for full enforcement`

### Key Issues Identified

- Image upload initially failed due to URL normalization and cross-origin static file serving issues; this was fixed.
- External API reliability still affects the accessibility feature.
- Browser-level end-to-end coverage remains limited.

### Evaluation

The prototype demonstrates that core features such as reports, SOS, community feed, and settings persistence operate as expected at the tested unit and route-integration level. Testing increases confidence in observed behaviour, but does not guarantee complete correctness. It is important to note that testing cannot guarantee that the system is fault-free, but instead increases confidence in its behaviour under representative conditions. Testing increases confidence in system behaviour but cannot guarantee the absence of defects.

Further critical evaluation points:
- reliance on external APIs introduces availability and dependency risk beyond the control of the prototype team; if a third-party service becomes slow, rate-limited, or unavailable, dependent features may degrade even when the local system is functioning correctly
- limited performance testing means the prototype has only been validated under normal local conditions; behaviour under higher traffic, larger datasets, or concurrent users therefore remains uncertain
- the absence of monitoring and observability restricts the team’s ability to detect, diagnose, and respond to failures quickly, which increases recovery time and reduces operational confidence
- the absence of a deployment pipeline means releases depend on manual setup and manual validation, increasing the likelihood of configuration drift, inconsistent environments, and human error
- these limitations matter because a system may appear functionally correct in controlled testing while still remaining unsuitable for real-world deployment if reliability, scalability, and maintainability have not been validated

### Release Evaluation

The system is suitable for demonstration as a functional prototype, as core features behave as expected under tested conditions. However, due to incomplete browser-level validation, reliance on external services, and limited performance and security testing, it is not yet suitable for production deployment.

The system is:
- `✅ Approved for prototype demonstration`
- `❌ Not approved for production deployment`

Justification:
- performance validation is limited
- security validation is limited
- the accessibility feature depends on external API availability
- full browser-level end-to-end validation is not yet complete

## DevOps and Code Management Evaluation

This evaluation reflects the current repository state and is framed at prototype level rather than production scale.

### DevOps Principles Validation

DevOps expects integration across the full lifecycle:

`Development -> Testing -> Deployment -> Monitoring -> Feedback`

#### Shared Responsibility

- Expected: shared ownership across development, testing, deployment, and operational support.
- Actual: partial integration is present through CI, backend logging, and a health endpoint.
- Gap: deployment ownership, monitoring, and operational response processes are not yet formalised.
- Improvement: define ownership for deployment and incident response, and document operational responsibilities.

#### Automation

- Expected: a repeatable automated pipeline covering validation, delivery, and deployment.
- Actual: CI now runs backend tests, backend lint, frontend tests, and frontend build validation.
- Gap: deployment automation, database migration automation, and post-deploy smoke checks are not yet implemented.
- Improvement: add migration steps, deployment workflows, and release validation checks.

#### Failure Detection and Recovery

- Expected: failures should be detected quickly and diagnosed using measurable signals.
- Actual: request logging and `/api/health` are available, and the accessibility feature includes timeout, cache, and fallback handling.
- Gap: there is no alerting, tracing, or central metrics collection.
- Improvement: add latency/error metrics, alerting, and external dependency monitoring.

#### Monitoring and Measurement

- Expected: measurable indicators such as availability, latency, and error rate.
- Actual: logs and endpoint-level checks exist, but no formal monitoring stack is configured.
- Gap: system behaviour is observable only through manual inspection.
- Improvement: add metrics collection and define prototype SLIs for key routes.

### CI/CD and Automation Evaluation

Current CI pipeline:

`Code -> Backend Tests -> Backend Lint -> Frontend Tests -> Frontend Build`

Observed gaps:
- no deployment stage
- no database migration stage
- no artifact publishing
- no rollback automation
- no post-deploy validation

Conclusion:
- Continuous Integration is partially established.
- Continuous Delivery and Deployment are not yet established.

### Code Management Validation

Strengths:
- backend and frontend are clearly separated
- backend feature logic is partially modularised under `features/`
- automated validation reduces regression risk during collaboration

Collaboration risks:
- `backend/server.js` remains a high-conflict hotspot
- large page-level frontend files increase merge risk for shared features
- some legacy documentation remains inconsistent with the current implementation

Implication:
- the project is workable for small-team collaboration, but parallel feature development still carries avoidable merge and regression risk.

### Branching and Versioning

Current state:
- Git-based source control is in use
- there is no documented branching or release workflow in the repository

Recommended approach:
- trunk-based development with short-lived feature branches
- pull requests gated by CI
- semantic version tags for release traceability

This would improve merge safety, rollback confidence, and auditability.

### Failure and Recovery Evaluation

| Scenario | Current Behaviour | Risk |
| --- | --- | --- |
| Backend crash during upload | Request fails; orphaned files are possible | Partial recovery only |
| Database failure | API generally returns `500`-level failures | No graceful degraded mode |
| External accessibility API failure | Timeout, cache, and fallback are applied | Best current resilience path |

Conclusion:
- the prototype handles some expected failure paths, but operational recovery is still limited.

### Team Collaboration Risks

- large shared files can increase merge conflicts
- inconsistent local environment setup can slow onboarding
- stale or fragmented documentation can create avoidable team confusion

These issues do not block prototype work, but they do reduce delivery efficiency and increase the chance of regression during team development.

### DevOps Maturity Score

| Area | Score |
| --- | --- |
| DevOps Adoption | `5/10` |
| Automation Level | `5/10` |
| Code Management Quality | `6/10` |
| Deployment Readiness | `3/10` |

### Final DevOps Evaluation

The system is suitable for prototype development and demonstration, but it is not yet DevOps-ready for production use.

Key risks:
- no deployment pipeline
- no monitoring or alerting stack
- merge-conflict pressure in large shared files
- incomplete environment standardisation

Highest-priority improvements:
- add deployment and post-deploy validation workflows
- modularise `backend/server.js` further to reduce conflict risk
- introduce metrics and alerting for critical routes and external dependencies
- standardise environment setup through scripts or containerisation

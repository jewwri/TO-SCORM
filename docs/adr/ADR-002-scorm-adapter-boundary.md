# ADR-002: SCORM Adapter Boundary

Status: Accepted

Context:
The original course called SCORM API methods directly from the course flow. LMS API failures are common during local preview, misconfigured launches, and vendor-specific player behavior.

Decision:
Place all SCORM 1.2 discovery, get/set/commit/finish calls, error translation, and preview fallback inside `scorm.js`.

Consequences:
Course behavior can be tested without an LMS and SCORM failures produce structured diagnostic logs. The adapter remains synchronous because SCORM 1.2 APIs are synchronous. A future xAPI or SCORM 2004 adapter can replace this boundary.

Alternatives Considered:
- Keep direct SCORM calls in `course.js`: rejected because it mixes LMS mechanism with course workflow.
- Add a third-party SCORM wrapper: rejected to avoid extra supply-chain and packaging dependencies.

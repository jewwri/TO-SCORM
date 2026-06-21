# ADR-007: Production Hardening Boundaries

Status: Accepted

Context:
The repository evolved from a single fixed SCORM course into an app that builds custom SCORM packages. Stale generated artifacts, hardcoded preview storage keys, and generic export metadata would make production behavior harder to reason about.

Decision:
Keep generated course artifacts out of the repository, generate `course-content.js` only during export, personalize exported `index.html` metadata from the generated course, validate runtime assets before ZIP creation, and namespace learner preview storage by course id.

Consequences:
The repo is cleaner and future changes are less likely to accidentally ship old demo content. Export failures happen earlier with explicit messages. Local preview data for one generated course no longer collides with another. The cost is slightly more package-builder code and stricter tests around export inputs.

Alternatives Considered:
- Commit a default generated course: rejected because it creates stale-content risk and blurs source versus output boundaries.
- Keep one global preview storage key: rejected because generated packages can be previewed locally outside an LMS.
- Let missing runtime assets fail during LMS launch: rejected because export should fail before users upload broken packages.

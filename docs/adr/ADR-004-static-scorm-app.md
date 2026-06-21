# ADR-004: Static SCORM App

Status: Accepted

Context:
The app needs to generate SCORM packages from user-provided lesson details and allow direct preview/iteration. It should be easy to run locally and deploy without external services.

Decision:
Build the generator as a static modular monolith in browser JavaScript with clean domain, application, infrastructure, and interface boundaries.

Consequences:
The app is simple to deploy and can run anywhere static files can be served. Domain generation stays testable without browsers or LMS APIs. The accepted cost is that generation is deterministic and template-based in this version.

Alternatives Considered:
- Backend service: rejected for the first version because no requirement needs server persistence or privileged credentials.
- Frontend framework: rejected because the UI is small and LMS/static compatibility benefits from minimal tooling.
- Microservices: rejected because there is one product workflow and no independent scaling boundary.

# ADR-001: Static Modular Monolith

Status: Accepted

Context:
SCORM packages are imported into LMS systems as static zip files. Adding a framework build pipeline would increase deployment complexity and can introduce LMS compatibility issues.

Decision:
Keep the package as static browser assets and separate responsibilities across small JavaScript modules.

Consequences:
The LMS upload path stays simple and resilient. Runtime dependencies are minimal. The cost is that DOM composition is written directly instead of delegated to a UI framework.

Alternatives Considered:
- React/Vite bundle: rejected because it adds build output and dependency management for a small SCO.
- Single-file script: rejected because it hides state, rendering, and LMS integration boundaries.

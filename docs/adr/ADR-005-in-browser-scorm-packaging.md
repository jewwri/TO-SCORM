# ADR-005: In-Browser SCORM Packaging

Status: Accepted

Context:
Generated lessons must be downloadable as SCORM 1.2 ZIP files. Adding a server solely for packaging would increase deployment and operational complexity.

Decision:
Build SCORM packages in the browser using a small infrastructure adapter that writes stored ZIP entries, generated `course-content.js`, and `imsmanifest.xml`.

Consequences:
Users can export packages without a backend. Tests can verify package bytes and manifest output with fake runtime assets. The accepted tradeoff is no ZIP compression and a narrower ZIP implementation than a full library.

Alternatives Considered:
- JSZip or another dependency: rejected to keep the app dependency-free and static.
- Server-side packaging: rejected because it would add hosting, auth, and failure modes without current need.
- Prebuilt package only: rejected because users need custom generated content.

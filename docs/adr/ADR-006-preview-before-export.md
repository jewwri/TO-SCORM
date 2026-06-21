# ADR-006: Preview Before Export

Status: Accepted

Context:
Users need to keep iterating on generated lessons directly from the UI before exporting. Embedding the final SCO in an iframe would couple generator state to learner runtime state.

Decision:
Render a semantic preview inside the generator UI using the same generated course model that is later serialized into the SCORM package.

Consequences:
Iteration is immediate, accessible, and isolated from SCORM tracking state. The accepted tradeoff is that the preview validates content shape and readability, while final LMS runtime behavior still requires SCORM smoke testing.

Alternatives Considered:
- Iframe SCO preview: rejected because it introduces LMS fallback state and asset URL complexity during editing.
- Download-only workflow: rejected because it prevents direct UI iteration.

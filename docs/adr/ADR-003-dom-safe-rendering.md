# ADR-003: DOM-Safe Rendering

Status: Accepted

Context:
The original implementation rendered course slides by assigning HTML strings to `innerHTML`. Even static content can become risky if later edited from a CMS, spreadsheet export, or generated source.

Decision:
Represent course content as structured data and render it with DOM APIs and `textContent`.

Consequences:
The interface layer prevents markup injection and makes future content changes safer. The tradeoff is more verbose rendering code.

Alternatives Considered:
- Continue using trusted HTML strings: rejected because the trust boundary would be implicit.
- Add a sanitizer library: rejected because current content needs simple text, lists, tiles, and callouts only.

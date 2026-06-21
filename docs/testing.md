# Testing

## Unit and Architecture Tests

```sh
npm test
```

This runs generator domain tests, package-builder tests, SCORM adapter tests, learner state tests, telemetry tests, and architecture fitness checks.

## Full Checks

```sh
npm run check
```

This runs tests plus JavaScript syntax checks for the generator and learner runtime.

## Local App Preview

```sh
make serve
```

Open `http://localhost:8000`. Use the form to generate and preview a course, then export the SCORM ZIP.

## Generated SCORM Smoke Test

1. Run `make serve`.
2. Open `http://localhost:8000`.
3. Generate a package with `Export Built SCORM`.
4. Upload the downloaded ZIP to a SCORM 1.2-compatible LMS.
5. Launch the SCO, complete the quiz, and verify `cmi.core.score.raw` plus `cmi.core.lesson_status`.

## App Packaging

```sh
make package
```

This creates `dist/scorm-app.zip`, which packages the app itself.

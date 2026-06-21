# SCORM

Static SCORM 1.2 app for building short, accessible microlearning packages from a topic, lesson theme, learner audience, objectives, and quiz settings.

## Run Locally

```sh
make serve
```

Open `http://localhost:8000`. The app generates a live lesson preview as fields change. Use `Export Built SCORM` to download the LMS-ready SCORM 1.2 package you built.

## Test

```sh
make test
make check
```

The suite uses Node's built-in test runner and has no npm dependency install step.

## Package This App

```sh
make package
```

The output is written to `dist/scorm-app.zip`. Built SCORM lessons are exported directly from the browser UI.

## Architecture

The repository is a static modular monolith with Clean Architecture boundaries:

- `src/scorm_generator/domain/`: request validation and deterministic course generation
- `src/scorm_generator/application/`: generation use case
- `src/scorm_generator/infrastructure/`: SCORM manifest and ZIP package adapter
- `src/scorm_generator/interfaces/web/`: browser UI composition
- `course-state.js`, `scorm.js`, `course.js`: learner runtime included in generated packages

See [docs/architecture.md](/Users/jewellwright/Downloads/cicd_scorm_package/docs/architecture.md) and [docs/testing.md](/Users/jewellwright/Downloads/cicd_scorm_package/docs/testing.md).

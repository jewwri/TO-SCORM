const assert = require("node:assert/strict");
const test = require("node:test");

const domain = require("../src/scorm_generator/domain/generator-domain");
const packageBuilder = require("../src/scorm_generator/infrastructure/scorm-package-builder");

function createRuntimeFiles(overrides) {
  return {
    "index.html": "<title>{{COURSE_TITLE}}</title><p>{{COURSE_DESCRIPTION}}</p>",
    "styles.css": "body{}",
    "telemetry.js": "window.Telemetry={};",
    "course-state.js": "window.CourseState={};",
    "scorm.js": "window.scorm={};",
    "course.js": "window.CourseApp={};",
    ...(overrides || {}),
  };
}

test("builds manifest and generated course content", () => {
  const course = domain.createCourse({ topic: "Hazard communication" });
  const scormPackage = packageBuilder.createScormPackage(course, createRuntimeFiles());

  assert.equal(scormPackage.filename, "hazard-communication-scorm12.zip");
  assert.match(scormPackage.manifest, /<schemaversion>1\.2<\/schemaversion>/);
  assert.match(scormPackage.files["course-content.js"], /Hazard Communication/);
  assert.ok(scormPackage.zipBytes.length > 500);
  assert.equal(scormPackage.zipBytes[0], 0x50);
  assert.equal(scormPackage.zipBytes[1], 0x4b);
});

test("export package replaces static content with the course the user built", () => {
  const course = domain.createCourse({
    topic: "Forklift safety",
    title: "Forklift Safety",
    learningObjectives: "Inspect the route\nReport blocked aisles",
  });
  const scormPackage = packageBuilder.createScormPackage(course, {
    ...createRuntimeFiles(),
  });

  assert.match(scormPackage.files["course-content.js"], /Forklift Safety/);
  assert.match(scormPackage.files["course-content.js"], /Inspect the route/);
  assert.doesNotMatch(scormPackage.files["course-content.js"], /CI\/CD Foundations/);
});

test("export package personalizes course html metadata", () => {
  const course = domain.createCourse({
    topic: "Fall prevention",
    description: "A focused lesson on preventing falls.",
  });
  const scormPackage = packageBuilder.createScormPackage(course, {
    ...createRuntimeFiles(),
  });

  assert.match(scormPackage.files["index.html"], /<title>Fall Prevention<\/title>/);
  assert.match(scormPackage.files["index.html"], /preventing falls/);
  assert.doesNotMatch(scormPackage.files["index.html"], /\{\{COURSE_TITLE\}\}/);
});

test("manifest escapes generated course titles", () => {
  const course = domain.createCourse({ topic: "Safety <basics> & reporting" });
  const manifest = packageBuilder.buildManifest(course);

  assert.match(manifest, /Safety &lt;Basics&gt; &amp; Reporting/);
});

test("rejects incomplete runtime assets before export", () => {
  const course = domain.createCourse({ topic: "Confined space entry" });

  assert.throws(
    () => packageBuilder.createScormPackage(course, { "index.html": "<html></html>" }),
    /Missing runtime asset: styles.css/,
  );
});

test("rejects unsafe zip entry names", () => {
  assert.throws(() => packageBuilder.buildZip({ "../evil.txt": "bad" }), /Unsafe ZIP entry/);
});

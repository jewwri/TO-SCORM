const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("course-state stays independent from browser and LMS mechanisms", () => {
  const source = read("course-state.js");
  const forbiddenPatterns = [
    /\bdocument\b/,
    /\blocalStorage\b/,
    /\bscorm\b/i,
    /\bLMS(?:Initialize|GetValue|SetValue|Commit|Finish)\b/,
    /\bfetch\b/,
    /\bXMLHttpRequest\b/,
  ];

  forbiddenPatterns.forEach((pattern) => {
    assert.equal(pattern.test(source), false, "forbidden dependency matched " + pattern);
  });
});

test("generator domain stays independent from browser, package, and LMS mechanisms", () => {
  const domainSource = read("src/scorm_generator/domain/generator-domain.js");
  const forbiddenPatterns = [
    /\bdocument\b/,
    /\blocalStorage\b/,
    /\bfetch\b/,
    /\bBlob\b/,
    /\bURL\b/,
    /\bzip\b/i,
    /\bLMS(?:Initialize|GetValue|SetValue|Commit|Finish)\b/,
  ];

  forbiddenPatterns.forEach((pattern) => {
    assert.equal(pattern.test(domainSource), false, "forbidden dependency matched " + pattern);
  });
});

test("course app does not inject dynamic content with innerHTML", () => {
  const source = read("course.js");
  assert.equal(/\.innerHTML\s*=/.test(source), false);
});

test("generator app does not inject dynamic content with innerHTML", () => {
  const source = read("src/scorm_generator/interfaces/web/scorm-app.js");
  assert.equal(/\.innerHTML\s*=/.test(source), false);
});

test("manifest declares runtime scripts and stylesheet", () => {
  const manifest = read("imsmanifest.xml");
  const html = read("index.html");
  const runtimeAssets = Array.from(html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)).map(
    (match) => match[1],
  );

  runtimeAssets.forEach((asset) => {
    assert.match(manifest, new RegExp('<file href="' + asset.replace(".", "\\.") + '"'));
  });
});

test("all manifest files exist", () => {
  const manifest = read("imsmanifest.xml");
  const manifestFiles = Array.from(manifest.matchAll(/<file href="([^"]+)"/g)).map(
    (match) => match[1],
  );

  manifestFiles.forEach((file) => {
    assert.equal(fs.existsSync(path.join(root, file)), true, file + " missing");
  });
});

test("repository does not include stale generated course artifacts", () => {
  const forbiddenPaths = [
    "course-content.js",
    "output",
    "tmp",
    "scripts/build_pdf.py",
  ];

  forbiddenPaths.forEach((file) => {
    assert.equal(fs.existsSync(path.join(root, file)), false, file + " should not exist");
  });
});

test("manifest does not declare files that are generated only at export time", () => {
  const manifest = read("imsmanifest.xml");
  assert.equal(/<file href="course-content\.js"/.test(manifest), false);
});

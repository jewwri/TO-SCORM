(function attachScormPackageBuilder(global) {
  "use strict";

  const RUNTIME_ASSETS = Object.freeze([
    "index.html",
    "styles.css",
    "telemetry.js",
    "course-content.js",
    "course-state.js",
    "scorm.js",
    "course.js",
  ]);

  function createScormPackage(course, runtimeFiles) {
    validateCourse(course);
    const runtime = runtimeFiles || {};
    validateRuntimeFiles(runtime);
    const files = {
      "imsmanifest.xml": buildManifest(course),
      "index.html": renderCourseHtmlTemplate(runtime["index.html"], course),
      "styles.css": runtime["styles.css"] || "",
      "telemetry.js": runtime["telemetry.js"] || "",
      "course-content.js": serializeCourseContent(course),
      "course-state.js": runtime["course-state.js"] || "",
      "scorm.js": runtime["scorm.js"] || "",
      "course.js": runtime["course.js"] || "",
    };

    return Object.freeze({
      filename: course.courseId + "-scorm12.zip",
      files: Object.freeze(files),
      manifest: files["imsmanifest.xml"],
      zipBytes: buildZip(files),
    });
  }

  function buildManifest(course) {
    const title = escapeXml(course.title);
    const identifier = "SCORM_" + course.courseId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<manifest identifier="' + identifier + '" version="1.0"',
      '  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"',
      '  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"',
      '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      '  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd',
      '                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">',
      "  <metadata>",
      "    <schema>ADL SCORM</schema>",
      "    <schemaversion>1.2</schemaversion>",
      "  </metadata>",
      '  <organizations default="ORG1">',
      '    <organization identifier="ORG1">',
      "      <title>" + title + "</title>",
      '      <item identifier="ITEM1" identifierref="RES1">',
      "        <title>" + title + "</title>",
      "      </item>",
      "    </organization>",
      "  </organizations>",
      "  <resources>",
      '    <resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index.html">',
      '      <file href="index.html" />',
      '      <file href="styles.css" />',
      '      <file href="telemetry.js" />',
      '      <file href="course-content.js" />',
      '      <file href="course-state.js" />',
      '      <file href="scorm.js" />',
      '      <file href="course.js" />',
      "    </resource>",
      "  </resources>",
      "</manifest>",
      "",
    ].join("\n");
  }

  function buildCourseHtml(course) {
    return [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
      "  <title>" + escapeHtml(course.title) + "</title>",
      '  <link rel="stylesheet" href="styles.css" />',
      "</head>",
      "<body>",
      '  <main class="shell">',
      '    <section class="hero" aria-labelledby="courseTitle">',
      "      <div>",
      '        <p class="eyebrow">SCORM 1.2 Microlearning</p>',
      '        <h1 id="courseTitle">' + escapeHtml(course.title) + "</h1>",
      '        <p class="subtitle">' + escapeHtml(course.description || "Generated SCORM lesson.") + "</p>",
      "      </div>",
      '      <div class="progress-wrap" aria-live="polite">',
      '        <span id="courseStatus">Slide 1</span>',
      '        <span id="progressLabel">0%</span>',
      '        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">',
      '          <div id="progressBar"></div>',
      "        </div>",
      "      </div>",
      "    </section>",
      '    <section id="slide" class="card" aria-live="polite"></section>',
      '    <nav class="controls" aria-label="Course navigation">',
      '      <button id="prevBtn" type="button">Back</button>',
      '      <button id="nextBtn" type="button">Next</button>',
      "    </nav>",
      "  </main>",
      '  <script src="telemetry.js"></script>',
      '  <script src="course-content.js"></script>',
      '  <script src="course-state.js"></script>',
      '  <script src="scorm.js"></script>',
      '  <script src="course.js"></script>',
      "</body>",
      "</html>",
      "",
    ].join("\n");
  }

  function renderCourseHtmlTemplate(template, course) {
    if (typeof template !== "string" || template.length === 0) {
      return buildCourseHtml(course);
    }
    const description = course.description || "Complete the lesson and knowledge check to record progress.";
    return template
      .replaceAll("{{COURSE_TITLE}}", escapeHtml(course.title))
      .replaceAll("{{COURSE_DESCRIPTION}}", escapeHtml(description));
  }

  function serializeCourseContent(course) {
    return [
      "(function attachCourseContent(global) {",
      '  "use strict";',
      "  const content = " + JSON.stringify(course, null, 2) + ";",
      "  global.CourseContent = Object.freeze(content);",
      '  if (typeof module !== "undefined" && module.exports) {',
      "    module.exports = content;",
      "  }",
      '})(typeof window !== "undefined" ? window : globalThis);',
      "",
    ].join("\n");
  }

  function buildZip(files) {
    validateZipFiles(files);
    const encoder = createTextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    Object.entries(files).forEach(([name, value]) => {
      const nameBytes = encoder.encode(name);
      const dataBytes = value instanceof Uint8Array ? value : encoder.encode(String(value));
      const crc = crc32(dataBytes);
      const localHeader = createLocalFileHeader(nameBytes, dataBytes.length, crc);
      const centralHeader = createCentralDirectoryHeader(nameBytes, dataBytes.length, crc, offset);

      localParts.push(localHeader, dataBytes);
      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    });

    const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
    const endRecord = createEndOfCentralDirectory(Object.keys(files).length, centralSize, offset);
    return concatUint8Arrays(localParts.concat(centralParts, [endRecord]));
  }

  function createLocalFileHeader(nameBytes, size, crc) {
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);
    return header;
  }

  function createCentralDirectoryHeader(nameBytes, size, crc, offset) {
    const header = new Uint8Array(46 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, offset, true);
    header.set(nameBytes, 46);
    return header;
  }

  function createEndOfCentralDirectory(fileCount, centralSize, centralOffset) {
    const record = new Uint8Array(22);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, fileCount, true);
    view.setUint16(10, fileCount, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
    view.setUint16(20, 0, true);
    return record;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concatUint8Arrays(parts) {
    const totalLength = parts.reduce((size, part) => size + part.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function validateCourse(course) {
    if (!course || typeof course !== "object") {
      throw new TypeError("A generated course is required.");
    }
    if (!course.courseId || !course.title) {
      throw new TypeError("Generated course must include courseId and title.");
    }
    if (!Array.isArray(course.slides) || course.slides.length === 0) {
      throw new TypeError("Generated course must include slides.");
    }
    if (!Array.isArray(course.questions) || course.questions.length === 0) {
      throw new TypeError("Generated course must include questions.");
    }
  }

  function validateRuntimeFiles(runtime) {
    RUNTIME_ASSETS.filter((asset) => asset !== "course-content.js").forEach((asset) => {
      if (typeof runtime[asset] !== "string" || runtime[asset].length === 0) {
        throw new Error("Missing runtime asset: " + asset);
      }
    });
  }

  function validateZipFiles(files) {
    Object.entries(files).forEach(([name, value]) => {
      if (!name || /(^|\/)\.\.(\/|$)/.test(name) || name.startsWith("/")) {
        throw new Error("Unsafe ZIP entry name: " + name);
      }
      if (value === undefined || value === null) {
        throw new Error("ZIP entry has no content: " + name);
      }
    });
  }

  function createTextEncoder() {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder();
    }
    return new (require("node:util").TextEncoder)();
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function escapeHtml(value) {
    return escapeXml(value);
  }

  const api = {
    RUNTIME_ASSETS,
    buildCourseHtml,
    buildManifest,
    buildZip,
    createScormPackage,
    renderCourseHtmlTemplate,
    serializeCourseContent,
    validateRuntimeFiles,
  };

  global.ScormPackageBuilder = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

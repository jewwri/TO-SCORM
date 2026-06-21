(function attachScormApp(global) {
  "use strict";

  const logger = global.Telemetry.createLogger("scorm-ui");
  const useCases = global.ScormGeneratorUseCases;
  const packageBuilder = global.ScormPackageBuilder;
  const domain = global.ScormGeneratorDomain;

  const elements = {};
  let currentCourse = null;
  let currentPackageUrl = "";

  function start() {
    try {
      bindElements();
      bindEvents();
      generateFromForm();
      logger.info("scorm_app_started", {});
    } catch (error) {
      logger.error("scorm_app_start_failed", { message: error.message });
      renderFatalStartupError(error);
    }
  }

  function bindElements() {
    [
      "generatorForm",
      "topic",
      "title",
      "lessonTheme",
      "audience",
      "description",
      "learningObjectives",
      "durationMinutes",
      "slideCount",
      "questionCount",
      "passingScore",
      "tone",
      "preview",
      "summary",
      "downloadPackage",
      "statusMessage",
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
      if (!elements[id]) {
        throw new Error("Missing required UI element: " + id);
      }
    });
  }

  function bindEvents() {
    elements.generatorForm.addEventListener("submit", (event) => {
      event.preventDefault();
      generateFromForm();
    });

    elements.generatorForm.addEventListener("input", debounce(generateFromForm, 350));

    elements.downloadPackage.addEventListener("click", async () => {
      if (!currentCourse) {
        return;
      }
      await downloadPackage(currentCourse);
    });
  }

  function generateFromForm() {
    try {
      const result = useCases.generateScormCourse(readFormInput(), { logger });
      currentCourse = result.course;
      renderSummary(result.summary);
      renderPreview(result.course);
      elements.downloadPackage.disabled = false;
      setStatus("Preview updated. Export the SCORM you built when ready.");
    } catch (error) {
      if (error instanceof domain.InvalidCourseRequestError) {
        currentCourse = null;
        elements.downloadPackage.disabled = true;
        setStatus(error.message);
        clearNode(elements.preview);
        return;
      }
      logger.error("generator_failed", { message: error.message });
      setStatus("Generation failed. Check the lesson details and try again.");
    }
  }

  function readFormInput() {
    return {
      audience: elements.audience.value,
      description: elements.description.value,
      durationMinutes: elements.durationMinutes.value,
      generatedAt: new Date().toISOString(),
      learningObjectives: elements.learningObjectives.value,
      lessonTheme: elements.lessonTheme.value,
      passingScore: elements.passingScore.value,
      questionCount: elements.questionCount.value,
      slideCount: elements.slideCount.value,
      title: elements.title.value,
      tone: elements.tone.value,
      topic: elements.topic.value,
    };
  }

  function renderSummary(summary) {
    clearNode(elements.summary);
    [
      ["Course ID", summary.courseId],
      ["Slides", summary.slideCount],
      ["Questions", summary.questionCount],
      ["Passing score", summary.passingScore + "%"],
    ].forEach(([label, value]) => {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = String(value);
      item.append(term, description);
      elements.summary.appendChild(item);
    });
  }

  function renderPreview(course) {
    clearNode(elements.preview);

    const header = document.createElement("div");
    header.className = "preview-header";
    const title = document.createElement("h2");
    title.textContent = course.title;
    const details = document.createElement("p");
    details.textContent =
      course.lessonTheme +
      " | " +
      course.slides.length +
      " slides | " +
      course.questions.length +
      " questions | passing score " +
      course.passingScore +
      "%";
    header.append(title, details);
    elements.preview.appendChild(header);

    course.slides.forEach((slide, index) => {
      const article = document.createElement("article");
      article.className = "preview-slide";
      article.setAttribute("aria-labelledby", "preview-slide-" + index);

      const slideTitle = document.createElement("h3");
      slideTitle.id = "preview-slide-" + index;
      slideTitle.textContent = index + 1 + ". " + slide.title;
      article.appendChild(slideTitle);

      if (slide.quiz) {
        article.appendChild(renderPreviewQuiz(course));
      } else {
        slide.blocks.forEach((block) => article.appendChild(renderPreviewBlock(block)));
      }

      elements.preview.appendChild(article);
    });

    logger.info("preview_rendered", {
      courseId: course.courseId,
      slideCount: course.slides.length,
    });
  }

  function renderPreviewBlock(block) {
    if (block.type === "paragraph") {
      const paragraph = document.createElement("p");
      paragraph.textContent = block.text;
      return paragraph;
    }

    if (block.type === "list") {
      const list = document.createElement("ul");
      block.items.forEach((item) => {
        const listItem = document.createElement("li");
        listItem.textContent = item;
        list.appendChild(listItem);
      });
      return list;
    }

    if (block.type === "tiles") {
      const grid = document.createElement("div");
      grid.className = "preview-grid";
      block.items.forEach((item) => {
        const tile = document.createElement("section");
        const label = document.createElement("strong");
        const text = document.createElement("span");
        label.textContent = item.label;
        text.textContent = item.text;
        tile.append(label, text);
        grid.appendChild(tile);
      });
      return grid;
    }

    if (block.type === "callout") {
      const callout = document.createElement("aside");
      callout.className = "preview-callout";
      callout.textContent = block.text;
      return callout;
    }

    logger.warn("unknown_preview_block", { type: block.type });
    return document.createTextNode("");
  }

  function renderPreviewQuiz(course) {
    const fragment = document.createDocumentFragment();
    const intro = document.createElement("p");
    intro.textContent = "These questions are included in the exported SCORM knowledge check.";
    fragment.appendChild(intro);

    course.questions.forEach((question, questionIndex) => {
      const section = document.createElement("section");
      section.className = "preview-question";
      const heading = document.createElement("h4");
      heading.textContent = questionIndex + 1 + ". " + question.prompt;
      const list = document.createElement("ol");
      question.options.forEach((option, optionIndex) => {
        const item = document.createElement("li");
        item.textContent = option + (optionIndex === question.answer ? " (correct)" : "");
        list.appendChild(item);
      });
      section.append(heading, list);
      fragment.appendChild(section);
    });

    return fragment;
  }

  async function downloadPackage(course) {
    try {
      const runtimeFiles = await loadRuntimeFiles();
      const scormPackage = packageBuilder.createScormPackage(course, runtimeFiles);
      if (currentPackageUrl) {
        URL.revokeObjectURL(currentPackageUrl);
      }
      currentPackageUrl = URL.createObjectURL(
        new Blob([scormPackage.zipBytes], { type: "application/zip" }),
      );

      const link = document.createElement("a");
      link.href = currentPackageUrl;
      link.download = scormPackage.filename;
      link.click();
      setStatus("Exported the SCORM you built: " + scormPackage.filename + ".");
      logger.info("scorm_package_downloaded", {
        courseId: course.courseId,
        filename: scormPackage.filename,
        bytes: scormPackage.zipBytes.length,
      });
    } catch (error) {
      logger.error("scorm_package_download_failed", { message: error.message });
      setStatus("Package export failed. Serve the app over HTTP and try again.");
    }
  }

  async function loadRuntimeFiles() {
    const assetPaths = {
      "index.html": "course-template.html",
      "styles.css": "styles.css",
      "telemetry.js": "telemetry.js",
      "course-state.js": "course-state.js",
      "scorm.js": "scorm.js",
      "course.js": "course.js",
    };
    const entries = await Promise.all(
      Object.entries(assetPaths).map(async ([name, path]) => {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load runtime asset " + path);
        }
        return [name, await response.text()];
      }),
    );
    return Object.fromEntries(entries);
  }

  function setStatus(message) {
    elements.statusMessage.textContent = message;
  }

  function renderFatalStartupError(error) {
    const fallback = document.createElement("div");
    fallback.className = "fatal-error";
    fallback.setAttribute("role", "alert");
    fallback.textContent = "SCORM could not start: " + error.message;
    document.body.prepend(fallback);
  }

  function clearNode(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function debounce(callback, waitMs) {
    let timeoutId = 0;
    return function debounced() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(callback, waitMs);
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);

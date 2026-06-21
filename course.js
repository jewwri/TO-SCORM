(function attachCourseApp(global) {
  "use strict";

  const content = global.CourseContent;
  const stateModel = global.CourseState;
  const logger = global.Telemetry.createLogger("course");
  const storageKeys = {
    lessonLocation: "cmi.core.lesson_location",
    lessonStatus: "cmi.core.lesson_status",
    scoreRaw: "cmi.core.score.raw",
    suspendData: "cmi.suspend_data",
  };

  let state = stateModel.createInitialState(content.slides.length);

  const elements = {
    courseTitle: document.getElementById("courseTitle"),
    progressBar: document.getElementById("progressBar"),
    progressLabel: document.getElementById("progressLabel"),
    slide: document.getElementById("slide"),
    prevButton: document.getElementById("prevBtn"),
    nextButton: document.getElementById("nextBtn"),
    status: document.getElementById("courseStatus"),
  };

  function start() {
    elements.courseTitle.textContent = content.title;
    applyCourseTheme(content.themeProfile);
    global.scorm.init();
    state = restoreSavedState();
    bindEvents();
    render();
    logger.info("course_started", {
      courseId: content.courseId,
      slideId: content.slides[state.currentSlide].id,
      previewMode: global.scorm.isPreviewMode(),
    });
  }

  function applyCourseTheme(themeProfile) {
    if (!themeProfile || !themeProfile.colors) {
      return;
    }
    document.body.classList.add("course-runtime");
    document.body.dataset.themeMotif = themeProfile.motif;
    document.body.style.setProperty("--course-theme-primary", themeProfile.colors.primary);
    document.body.style.setProperty("--course-theme-accent", themeProfile.colors.accent);
    document.body.style.setProperty("--course-theme-background", themeProfile.colors.background);
    document.body.style.setProperty("--course-theme-surface", themeProfile.colors.surface);
    document.body.style.setProperty("--course-theme-text", themeProfile.colors.text);
  }

  function restoreSavedState() {
    const savedState = stateModel.parseSerializedState(global.scorm.get(storageKeys.suspendData));
    const restored = stateModel.restoreState(savedState, content.slides.length);
    const legacyLocation = global.scorm.get(storageKeys.lessonLocation);

    if (!savedState && legacyLocation !== "") {
      return stateModel.moveToSlide(restored, legacyLocation);
    }
    return restored;
  }

  function bindEvents() {
    elements.prevButton.addEventListener("click", () => {
      if (state.currentSlide > 0) {
        state = stateModel.moveToSlide(state, state.currentSlide - 1);
        render();
      }
    });

    elements.nextButton.addEventListener("click", () => {
      const slide = content.slides[state.currentSlide];
      if (slide.quiz) {
        submitQuiz();
        return;
      }

      state = stateModel.moveToSlide(state, state.currentSlide + 1);
      render();
    });
  }

  function render() {
    const slide = content.slides[state.currentSlide];
    renderProgress();
    renderControls(slide);
    replaceChildren(elements.slide, renderSlide(slide));
    persistProgress();
    logger.info("slide_rendered", { slideId: slide.id, slideNumber: state.currentSlide + 1 });
  }

  function renderProgress() {
    const progress = state.submitted
      ? 100
      : stateModel.calculateProgress(state.currentSlide, content.slides.length);
    elements.progressBar.style.width = progress + "%";
    elements.progressBar.setAttribute("aria-valuenow", String(progress));
    elements.progressLabel.textContent = progress + "%";
    elements.status.textContent = state.submitted
      ? "Complete"
      : "Slide " + (state.currentSlide + 1) + " of " + content.slides.length;
  }

  function renderControls(slide) {
    elements.prevButton.disabled = state.currentSlide === 0 || state.submitted;
    elements.nextButton.disabled =
      state.submitted || (slide.quiz && !stateModel.canSubmitQuiz(state, content.questions.length));
    elements.nextButton.textContent = slide.quiz ? "Submit" : "Next";
  }

  function renderSlide(slide) {
    if (state.submitted) {
      return renderResult();
    }

    const fragment = document.createDocumentFragment();
    const heading = document.createElement("h2");
    heading.textContent = slide.title;
    fragment.appendChild(heading);

    if (slide.quiz) {
      fragment.appendChild(renderQuiz());
      return fragment;
    }

    slide.blocks.forEach((block) => fragment.appendChild(renderBlock(block)));
    return fragment;
  }

  function renderBlock(block) {
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
      grid.className = "grid";
      block.items.forEach((item) => {
        const tile = document.createElement("article");
        tile.className = "tile";
        const label = document.createElement("strong");
        label.textContent = item.label;
        const text = document.createElement("span");
        text.textContent = item.text;
        tile.append(label, text);
        grid.appendChild(tile);
      });
      return grid;
    }

    if (block.type === "callout") {
      const callout = document.createElement("aside");
      callout.className = "checkpoint";
      callout.textContent = block.text;
      return callout;
    }

    logger.warn("unknown_content_block", { type: block.type });
    return document.createTextNode("");
  }

  function renderQuiz() {
    const fragment = document.createDocumentFragment();
    const instructions = document.createElement("p");
    instructions.textContent =
      "Answer each question. A score of " + content.passingScore + "% or higher marks the course as passed.";
    fragment.appendChild(instructions);

    content.questions.forEach((question, questionIndex) => {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "question";

      const legend = document.createElement("legend");
      legend.textContent = questionIndex + 1 + ". " + question.prompt;
      fieldset.appendChild(legend);

      question.options.forEach((option, answerIndex) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "q" + questionIndex;
        input.value = String(answerIndex);
        input.checked = state.answers[questionIndex] === answerIndex;
        input.addEventListener("change", () => {
          state = stateModel.answerQuestion(state, questionIndex, answerIndex);
          persistProgress();
          renderControls(content.slides[state.currentSlide]);
        });
        label.append(input, document.createTextNode(" " + option));
        fieldset.appendChild(label);
      });

      fragment.appendChild(fieldset);
    });

    return fragment;
  }

  function submitQuiz() {
    if (!stateModel.canSubmitQuiz(state, content.questions.length)) {
      logger.warn("quiz_submit_blocked", { reason: "incomplete_answers" });
      return;
    }

    state = stateModel.submitQuiz(state, content.questions, content.passingScore);
    global.scorm.set(storageKeys.scoreRaw, state.score);
    global.scorm.set(storageKeys.lessonStatus, state.passed ? "passed" : "failed");
    persistProgress();
    render();
    logger.info("quiz_submitted", { score: state.score, passed: state.passed });
  }

  function renderResult() {
    const fragment = document.createDocumentFragment();
    const heading = document.createElement("h2");
    heading.textContent = "Course Complete";

    const result = document.createElement("p");
    result.className = "result";
    result.textContent = "Score: " + state.score + "%";

    const message = document.createElement("p");
    message.textContent = state.passed
      ? "Passed. Your LMS should record completion."
      : "Not passed. Review the lesson and try again.";

    fragment.append(heading, result, message);
    return fragment;
  }

  function persistProgress() {
    global.scorm.set(storageKeys.lessonLocation, String(state.currentSlide));
    global.scorm.set(storageKeys.suspendData, stateModel.serializeState(state));
    global.scorm.commit();
  }

  function replaceChildren(element, child) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
    element.appendChild(child);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);

(function attachGenerateScormUseCase(global) {
  "use strict";

  const domain = loadDomain(global);

  function generateScormCourse(input, dependencies) {
    const deps = dependencies || {};
    const logger = deps.logger || fallbackLogger();
    const course = domain.createCourse(input);

    logger.info("scorm_course_generated", {
      courseId: course.courseId,
      slideCount: course.slides.length,
      questionCount: course.questions.length,
      topic: course.title,
    });

    return Object.freeze({
      course,
      summary: Object.freeze({
        courseId: course.courseId,
        title: course.title,
        slideCount: course.slides.length,
        questionCount: course.questions.length,
        passingScore: course.passingScore,
      }),
    });
  }

  function loadDomain(globalObject) {
    if (globalObject.ScormGeneratorDomain) {
      return globalObject.ScormGeneratorDomain;
    }
    if (typeof require === "function") {
      return require("../domain/generator-domain");
    }
    throw new Error("ScormGeneratorDomain is not available.");
  }

  function fallbackLogger() {
    return {
      info() {},
      warn() {},
      error() {},
    };
  }

  const api = { generateScormCourse };
  global.ScormGeneratorUseCases = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

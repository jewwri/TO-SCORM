const assert = require("node:assert/strict");
const test = require("node:test");

const domain = require("../src/scorm_generator/domain/generator-domain");

test("creates a course from lesson details", () => {
  const course = domain.createCourse({
    topic: "Data privacy basics",
    title: "Data Privacy Basics",
    lessonTheme: "university student services",
    audience: "support agents",
    learningObjectives: "Identify personal data\nEscalate risky requests",
    questionCount: 2,
  });

  assert.equal(course.courseId, "data-privacy-basics");
  assert.equal(course.title, "Data Privacy Basics");
  assert.equal(course.questions.length, 2);
  assert.equal(course.themeProfile.name, "Academic");
  assert.equal(course.themeProfile.motif, "crest");
  assert.equal(course.slides.at(-1).quiz, true);
  assert.match(course.slides[0].blocks[0].text, /support agents/);
});

test("maps game themes into a visual course profile", () => {
  const course = domain.createCourse({
    topic: "Secure passwords",
    lessonTheme: "retro game quest",
  });

  assert.equal(course.themeProfile.name, "Game");
  assert.equal(course.themeProfile.motif, "level-up");
  assert.equal(course.themeProfile.colors.accent, "#7cfc00");
});

test("creates deterministic custom theme profiles", () => {
  const first = domain.createThemeProfile("desert robotics lab");
  const second = domain.createThemeProfile("desert robotics lab");

  assert.deepEqual(first, second);
  assert.equal(first.name, "Desert Robotics Lab");
  assert.match(first.colors.primary, /^hsl\(/);
});

test("rejects missing topic with a domain error", () => {
  assert.throws(
    () => domain.createCourse({ topic: "   " }),
    domain.InvalidCourseRequestError,
  );
});

test("normalizes numeric generation bounds", () => {
  const request = domain.normalizeGenerationRequest({
    topic: "Accessibility",
    durationMinutes: 200,
    passingScore: 10,
    questionCount: 99,
  });

  assert.equal(request.durationMinutes, 60);
  assert.equal(request.passingScore, 50);
  assert.equal(request.questionCount, 6);
});

test("honors requested slide count without duplicating the quiz", () => {
  const course = domain.createCourse({
    topic: "Lockout tagout",
    slideCount: 8,
  });
  const quizSlides = course.slides.filter((slide) => slide.quiz === true);

  assert.equal(course.slides.length, 8);
  assert.equal(quizSlides.length, 1);
  assert.equal(course.slides.at(-1).id, "knowledge-check");
});

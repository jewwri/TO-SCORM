const assert = require("node:assert/strict");
const test = require("node:test");

const state = require("../course-state");

const content = Object.freeze({
  passingScore: 75,
  slides: Object.freeze([
    { id: "one" },
    { id: "two" },
    { id: "three" },
    { id: "four" },
    { id: "five" },
    { id: "quiz", quiz: true },
  ]),
  questions: Object.freeze([
    { answer: 0 },
    { answer: 0 },
    { answer: 0 },
    { answer: 0 },
  ]),
});

test("calculates progress across slides", () => {
  assert.equal(state.calculateProgress(0, 6), 0);
  assert.equal(state.calculateProgress(3, 6), 60);
  assert.equal(state.calculateProgress(5, 6), 100);
});

test("restores saved state with bounds checking", () => {
  const restored = state.restoreState(
    {
      currentSlide: 99,
      answers: { 0: "1", bad: "x" },
      submitted: true,
      score: 75,
      passed: true,
    },
    content.slides.length,
  );

  assert.equal(restored.currentSlide, 0);
  assert.deepEqual(restored.answers, { 0: 1 });
  assert.equal(restored.submitted, true);
  assert.equal(restored.score, 75);
  assert.equal(restored.passed, true);
});

test("blocks quiz submission until all questions are answered", () => {
  let courseState = state.createInitialState(content.slides.length);
  assert.equal(state.canSubmitQuiz(courseState, content.questions.length), false);

  content.questions.forEach((_question, index) => {
    courseState = state.answerQuestion(courseState, index, 0);
  });

  assert.equal(state.canSubmitQuiz(courseState, content.questions.length), true);
});

test("scores quiz and applies passing threshold", () => {
  const answers = { 0: 0, 1: 0, 2: 0, 3: 1 };
  const result = state.scoreQuiz(content.questions, answers, content.passingScore);

  assert.equal(result.correct, 3);
  assert.equal(result.score, 75);
  assert.equal(result.passed, true);
});

test("serializes and parses course state", () => {
  const courseState = state.submitQuiz(
    {
      ...state.createInitialState(content.slides.length),
      answers: { 0: 0, 1: 0, 2: 0, 3: 0 },
    },
    content.questions,
    content.passingScore,
  );

  const serialized = state.serializeState(courseState);
  assert.deepEqual(state.parseSerializedState(serialized), {
    currentSlide: 0,
    answers: { 0: 0, 1: 0, 2: 0, 3: 0 },
    submitted: true,
    score: 100,
    passed: true,
  });
  assert.equal(state.parseSerializedState("{not-json"), null);
});

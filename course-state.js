(function attachCourseState(global) {
  "use strict";

  function clampSlideIndex(value, slideCount) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0 || parsed >= slideCount) {
      return 0;
    }
    return parsed;
  }

  function createInitialState(slideCount) {
    return {
      currentSlide: 0,
      totalSlides: slideCount,
      answers: {},
      submitted: false,
      score: null,
      passed: false,
    };
  }

  function restoreState(savedState, slideCount) {
    const state = createInitialState(slideCount);
    if (!savedState || typeof savedState !== "object") {
      return state;
    }

    state.currentSlide = clampSlideIndex(savedState.currentSlide, slideCount);
    state.answers = sanitizeAnswers(savedState.answers);
    state.submitted = savedState.submitted === true;
    state.score = Number.isFinite(savedState.score) ? savedState.score : null;
    state.passed = savedState.passed === true;
    return state;
  }

  function sanitizeAnswers(answers) {
    if (!answers || typeof answers !== "object") {
      return {};
    }

    return Object.entries(answers).reduce((cleaned, entry) => {
      const questionIndex = Number.parseInt(entry[0], 10);
      const answerIndex = Number.parseInt(entry[1], 10);
      if (!Number.isNaN(questionIndex) && !Number.isNaN(answerIndex) && answerIndex >= 0) {
        cleaned[questionIndex] = answerIndex;
      }
      return cleaned;
    }, {});
  }

  function calculateProgress(currentSlide, totalSlides) {
    if (totalSlides <= 1) {
      return 100;
    }
    return Math.round((currentSlide / (totalSlides - 1)) * 100);
  }

  function answerQuestion(state, questionIndex, answerIndex) {
    return {
      ...state,
      answers: {
        ...state.answers,
        [questionIndex]: answerIndex,
      },
    };
  }

  function moveToSlide(state, targetSlide) {
    return {
      ...state,
      currentSlide: clampSlideIndex(targetSlide, state.totalSlides),
    };
  }

  function canSubmitQuiz(state, questionCount) {
    return Array.from({ length: questionCount }).every((_, index) =>
      Number.isInteger(state.answers[index]),
    );
  }

  function scoreQuiz(questions, answers, passingScore) {
    const correct = questions.reduce((count, question, index) => {
      return answers[index] === question.answer ? count + 1 : count;
    }, 0);
    const score = Math.round((correct / questions.length) * 100);
    return {
      correct,
      score,
      passed: score >= passingScore,
    };
  }

  function submitQuiz(state, questions, passingScore) {
    const result = scoreQuiz(questions, state.answers, passingScore);
    return {
      ...state,
      submitted: true,
      score: result.score,
      passed: result.passed,
    };
  }

  function serializeState(state) {
    return JSON.stringify({
      currentSlide: state.currentSlide,
      answers: state.answers,
      submitted: state.submitted,
      score: state.score,
      passed: state.passed,
    });
  }

  function parseSerializedState(serialized) {
    if (!serialized) {
      return null;
    }
    try {
      const parsed = JSON.parse(serialized);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  const api = {
    calculateProgress,
    canSubmitQuiz,
    createInitialState,
    moveToSlide,
    parseSerializedState,
    restoreState,
    scoreQuiz,
    serializeState,
    submitQuiz,
    answerQuestion,
  };

  global.CourseState = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(globalThis);

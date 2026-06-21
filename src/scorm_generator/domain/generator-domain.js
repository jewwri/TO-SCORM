(function attachScormGeneratorDomain(global) {
  "use strict";

  const DEFAULTS = Object.freeze({
    audience: "busy adult learners",
    durationMinutes: 10,
    lessonTheme: "practical workplace training",
    passingScore: 80,
    questionCount: 3,
    slideCount: 5,
    tone: "clear and practical",
  });

  class InvalidCourseRequestError extends Error {
    constructor(message, details) {
      super(message);
      this.name = "InvalidCourseRequestError";
      this.details = details || {};
    }
  }

  function createCourse(request) {
    const normalized = normalizeGenerationRequest(request);
    const objectives = normalized.learningObjectives.length > 0
      ? normalized.learningObjectives
      : createDefaultObjectives(normalized.topic);
    const lessonId = slugify(normalized.topic);
    const coreConcepts = createCoreConcepts(normalized.topic, objectives);

    const instructionalSlides = [
      createWelcomeSlide(normalized, objectives),
      createConceptSlide(normalized, coreConcepts),
      createApplicationSlide(normalized, objectives),
      createPracticeSlide(normalized, objectives),
    ];
    const targetInstructionalSlideCount = normalized.slideCount - 1;
    const generatedSlides = createInstructionalSlides(
      instructionalSlides,
      normalized,
      objectives,
      targetInstructionalSlideCount,
    );

    return Object.freeze({
      courseId: lessonId,
      description: normalized.description,
      generatedAt: normalized.generatedAt,
      lessonTheme: normalized.lessonTheme,
      themeProfile: Object.freeze(createThemeProfile(normalized.lessonTheme)),
      title: normalized.title || titleCase(normalized.topic),
      passingScore: normalized.passingScore,
      slides: Object.freeze(
        generatedSlides.concat([{ id: "knowledge-check", title: "Knowledge Check", quiz: true }]),
      ),
      questions: Object.freeze(createQuestions(normalized, objectives, normalized.questionCount)),
    });
  }

  function normalizeGenerationRequest(request) {
    const input = request && typeof request === "object" ? request : {};
    const topic = cleanText(input.topic, 90);
    if (!topic) {
      throw new InvalidCourseRequestError("Topic is required.", { field: "topic" });
    }

    return Object.freeze({
      audience: cleanText(input.audience, 90) || DEFAULTS.audience,
      description: cleanText(input.description, 260),
      durationMinutes: clampInteger(input.durationMinutes, 3, 60, DEFAULTS.durationMinutes),
      generatedAt: input.generatedAt || new Date().toISOString(),
      lessonTheme: cleanText(input.lessonTheme, 100) || DEFAULTS.lessonTheme,
      learningObjectives: parseObjectives(input.learningObjectives),
      passingScore: clampInteger(input.passingScore, 50, 100, DEFAULTS.passingScore),
      questionCount: clampInteger(input.questionCount, 2, 6, DEFAULTS.questionCount),
      slideCount: clampInteger(input.slideCount, 4, 8, DEFAULTS.slideCount),
      tone: cleanText(input.tone, 80) || DEFAULTS.tone,
      title: cleanText(input.title, 100),
      topic,
    });
  }

  function createWelcomeSlide(request, objectives) {
    return {
      id: "overview",
      title: "Start Here",
      blocks: [
        {
          type: "paragraph",
          text:
            "This " +
            request.durationMinutes +
            "-minute lesson introduces " +
            request.topic +
            " for " +
            request.audience +
            " using a " +
            request.lessonTheme +
            " theme.",
        },
        {
          type: "list",
          items: objectives.map((objective) => "By the end, you will be able to " + lowerFirst(objective) + "."),
        },
      ],
    };
  }

  function createConceptSlide(request, concepts) {
    return {
      id: "key-concepts",
      title: "Key Ideas",
      blocks: [
        {
          type: "paragraph",
          text:
            "Use these ideas as anchors while applying " +
            request.topic +
            " in realistic situations.",
        },
        {
          type: "tiles",
          items: concepts,
        },
      ],
    };
  }

  function createApplicationSlide(request, objectives) {
    return {
      id: "real-world-application",
      title: "Apply It",
      blocks: [
        {
          type: "paragraph",
          text:
            "A useful lesson connects decisions, actions, and feedback. For " +
            request.topic +
            ", focus on what a learner can recognize, choose, and explain.",
        },
        {
          type: "list",
          items: objectives.map((objective) => "Look for a moment where the learner must " + lowerFirst(objective) + "."),
        },
      ],
    };
  }

  function createPracticeSlide(request, objectives) {
    return {
      id: "practice",
      title: "Practice Scenario",
      blocks: [
        {
          type: "paragraph",
          text:
            "Imagine a learner encounters a situation involving " +
            request.topic +
            ". They need to make a practical choice and explain why it fits the goal.",
        },
        {
          type: "callout",
          text:
            "Practice prompt: choose one action that supports '" +
            objectives[0] +
            "' and identify one risk if that action is skipped.",
        },
      ],
    };
  }

  function createInstructionalSlides(baseSlides, request, objectives, targetCount) {
    const slides = baseSlides.slice(0, Math.min(baseSlides.length, targetCount));
    let nextObjectiveIndex = 0;
    while (slides.length < targetCount) {
      const objective = objectives[nextObjectiveIndex % objectives.length];
      const slideNumber = slides.length + 1;
      slides.push({
        id: "reinforcement-" + slideNumber,
        title: "Reinforce the Skill",
        blocks: [
          {
            type: "paragraph",
            text:
              "Use this checkpoint to connect " +
              request.topic +
              " back to a specific learner behavior.",
          },
          {
            type: "callout",
            text:
              "Ask the learner to explain how they would " +
              lowerFirst(objective) +
              " in one sentence before moving on.",
          },
        ],
      });
      nextObjectiveIndex += 1;
    }
    return slides;
  }

  function createCoreConcepts(topic, objectives) {
    return objectives.slice(0, 4).map((objective, index) => ({
      label: "Concept " + (index + 1),
      text: titleCase(topic) + " requires learners to " + lowerFirst(objective) + ".",
    }));
  }

  function createQuestions(request, objectives, questionCount) {
    return Array.from({ length: questionCount }).map((_, index) => {
      const objective = objectives[index % objectives.length];
      return {
        id: "question-" + (index + 1),
        prompt: "Which choice best supports the objective: " + objective + "?",
        options: [
          "Apply the lesson concept in a specific, observable action.",
          "Skip feedback because the theme is already familiar.",
          "Treat the topic as background information with no practice.",
        ],
        answer: 0,
        rationale:
          "The best answer requires observable learner action tied to " +
          request.topic +
          ".",
      };
    });
  }

  function createDefaultObjectives(topic) {
    return [
      "describe the purpose of " + topic,
      "recognize the most important learner decisions",
      "apply the concept in a realistic scenario",
    ];
  }

  function createThemeProfile(themeText) {
    const normalized = themeText.toLowerCase();
    const presets = [
      {
        match: /\b(university|college|campus|school|academic|alumni|student)\b/,
        profile: createProfile("Academic", "crest", "#17315f", "#f5b82e", "#eef3fb", "#ffffff", "#162033"),
      },
      {
        match: /\b(game|gaming|arcade|quest|rpg|level|player|esport)\b/,
        profile: createProfile("Game", "level-up", "#211253", "#7cfc00", "#f2efff", "#ffffff", "#1c1534"),
      },
      {
        match: /\b(health|medical|clinic|hospital|wellness|care)\b/,
        profile: createProfile("Healthcare", "care", "#0f766e", "#67e8f9", "#ecfeff", "#ffffff", "#12333a"),
      },
      {
        match: /\b(finance|bank|banking|investment|insurance|wealth)\b/,
        profile: createProfile("Finance", "ledger", "#0f3d2e", "#d6b15f", "#f5f2e8", "#ffffff", "#18251f"),
      },
      {
        match: /\b(sports|fitness|team|coach|athlete|stadium)\b/,
        profile: createProfile("Sports", "scoreboard", "#123c69", "#ffb703", "#edf6ff", "#ffffff", "#102336"),
      },
      {
        match: /\b(luxury|premium|executive|boutique|fashion)\b/,
        profile: createProfile("Premium", "editorial", "#241a1f", "#d6a84f", "#f8f3ea", "#ffffff", "#241a1f"),
      },
    ];

    const preset = presets.find((candidate) => candidate.match.test(normalized));
    if (preset) {
      return preset.profile;
    }

    const hue = hashString(themeText) % 360;
    const primary = "hsl(" + hue + " 58% 32%)";
    const accent = "hsl(" + ((hue + 42) % 360) + " 86% 58%)";
    const background = "hsl(" + hue + " 44% 95%)";
    return createProfile(titleCase(themeText), "custom", primary, accent, background, "#ffffff", "#172033");
  }

  function createProfile(name, motif, primary, accent, background, surface, text) {
    return Object.freeze({
      name,
      motif,
      colors: Object.freeze({
        accent,
        background,
        primary,
        surface,
        text,
      }),
    });
  }

  function parseObjectives(value) {
    if (Array.isArray(value)) {
      return value.map((item) => cleanText(item, 140)).filter(Boolean).slice(0, 8);
    }
    if (typeof value !== "string") {
      return [];
    }
    return value
      .split(/\r?\n|;/)
      .map((item) => cleanText(item.replace(/^[-*]\s*/, ""), 140))
      .filter(Boolean)
      .slice(0, 8);
  }

  function cleanText(value, maxLength) {
    if (typeof value !== "string") {
      return "";
    }
    return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  }

  function clampInteger(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  function slugify(value) {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return slug || "generated-course";
  }

  function hashString(value) {
    return Array.from(value).reduce((hash, character) => {
      return (hash * 31 + character.charCodeAt(0)) >>> 0;
    }, 17);
  }

  function titleCase(value) {
    return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function lowerFirst(value) {
    if (!value) {
      return value;
    }
    return value.charAt(0).toLowerCase() + value.slice(1);
  }

  const api = {
    InvalidCourseRequestError,
    createCourse,
    createThemeProfile,
    normalizeGenerationRequest,
    slugify,
  };

  global.ScormGeneratorDomain = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

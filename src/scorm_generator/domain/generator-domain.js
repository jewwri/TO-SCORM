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

  const THEME_FAMILIES = Object.freeze([
    createFamily("Arcade", "maze", /\b(pacman|pac-man|arcade|maze|8-bit|pixel|retro)\b/, "#2563eb", "#ffd400", "#070b18", "#111827", "#f8fafc"),
    createFamily("Academic", "crest", /\b(university|college|campus|school|academic|alumni|student|faculty|ivy)\b/, "#17315f", "#f5b82e", "#eef3fb", "#ffffff", "#162033"),
    createFamily("Game", "level-up", /\b(game|gaming|level|player|esport|esports|controller)\b/, "#211253", "#7cfc00", "#f2efff", "#ffffff", "#1c1534"),
    createFamily("Fantasy", "quest", /\b(fantasy|dragon|wizard|magic|kingdom|castle|quest|myth)\b/, "#4c1d95", "#f59e0b", "#f4efff", "#ffffff", "#211436"),
    createFamily("Space", "orbit", /\b(space|galaxy|planet|orbit|astronaut|cosmic|nasa|star)\b/, "#111827", "#38bdf8", "#eaf6ff", "#ffffff", "#111827"),
    createFamily("Ocean", "wave", /\b(ocean|sea|marine|beach|coastal|surf|water|navy)\b/, "#075985", "#22d3ee", "#ecfeff", "#ffffff", "#12313f"),
    createFamily("Nature", "organic", /\b(nature|forest|garden|botanical|eco|green|sustainability|outdoor)\b/, "#166534", "#84cc16", "#f0fdf4", "#ffffff", "#17331d"),
    createFamily("Cyber", "circuit", /\b(cyber|hacker|matrix|neon|ai|robot|sci-fi|technology|tech)\b/, "#0f172a", "#22c55e", "#ecfdf5", "#ffffff", "#0f172a"),
    createFamily("Sports", "scoreboard", /\b(sports|fitness|team|coach|athlete|stadium|league)\b/, "#123c69", "#ffb703", "#edf6ff", "#ffffff", "#102336"),
    createFamily("Healthcare", "care", /\b(health|medical|clinic|hospital|wellness|care|patient)\b/, "#0f766e", "#67e8f9", "#ecfeff", "#ffffff", "#12333a"),
    createFamily("Finance", "ledger", /\b(finance|bank|banking|investment|insurance|wealth|money)\b/, "#0f3d2e", "#d6b15f", "#f5f2e8", "#ffffff", "#18251f"),
    createFamily("Premium", "editorial", /\b(luxury|premium|executive|boutique|fashion|minimal|black tie)\b/, "#241a1f", "#d6a84f", "#f8f3ea", "#ffffff", "#241a1f"),
    createFamily("Kids", "playful", /\b(kids|children|playground|toy|cartoon|comic|fun)\b/, "#7c3aed", "#facc15", "#fef3c7", "#ffffff", "#2e1065"),
  ]);

  const NAMED_COLORS = Object.freeze({
    black: "#111827",
    blue: "#2563eb",
    brown: "#7c2d12",
    gold: "#d6a84f",
    green: "#16a34a",
    navy: "#17315f",
    orange: "#f97316",
    pink: "#db2777",
    purple: "#7c3aed",
    red: "#dc2626",
    teal: "#0d9488",
    white: "#ffffff",
    yellow: "#facc15",
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
    const themeProfile = normalizeThemeProfile(request && request.themeProfile) ||
      createThemeProfile(normalized.lessonTheme);
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
      themeProfile: Object.freeze(themeProfile),
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
            ".",
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
    const explicitColors = extractNamedColors(normalized);
    const family = THEME_FAMILIES.find((candidate) => candidate.match.test(normalized));
    if (family) {
      return familyToProfile(family, explicitColors);
    }

    const motifs = ["custom", "diagonal", "orbit", "wave", "circuit", "organic", "scoreboard"];
    const hue = hashString(themeText) % 360;
    const motif = motifs[hashString(themeText + ":motif") % motifs.length];
    const primary = "hsl(" + hue + " 58% 32%)";
    const accent = "hsl(" + ((hue + 42) % 360) + " 86% 58%)";
    const background = "hsl(" + hue + " 44% 95%)";
    return createProfile(
      "Custom",
      motif,
      explicitColors[0] || primary,
      explicitColors[1] || accent,
      background,
      "#ffffff",
      "#172033",
    );
  }

  function createFamily(name, motif, match, primary, accent, background, surface, text) {
    return Object.freeze({
      name,
      motif,
      match,
      colors: Object.freeze({
        accent,
        background,
        primary,
        surface,
        text,
      }),
    });
  }

  function familyToProfile(family, explicitColors) {
    const primary = explicitColors[0] || family.colors.primary;
    const accent = explicitColors[1] || family.colors.accent;
    return createProfile(
      family.name,
      family.motif,
      primary,
      accent,
      family.colors.background,
      family.colors.surface,
      family.colors.text,
    );
  }

  function extractNamedColors(value) {
    return Object.entries(NAMED_COLORS)
      .filter(([name]) => new RegExp("\\b" + name + "\\b").test(value))
      .map((entry) => entry[1])
      .slice(0, 2);
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

  function normalizeThemeProfile(value) {
    if (!value || typeof value !== "object" || !value.colors || typeof value.colors !== "object") {
      return null;
    }
    const name = cleanText(value.name, 60) || "Imported";
    const motif = sanitizeMotif(value.motif);
    const colors = value.colors;
    const primary = sanitizeCssColor(colors.primary);
    const accent = sanitizeCssColor(colors.accent);
    const background = sanitizeCssColor(colors.background);
    const surface = sanitizeCssColor(colors.surface);
    const text = sanitizeCssColor(colors.text);

    if (!primary || !accent || !background || !surface || !text) {
      return null;
    }
    return createProfile(name, motif, primary, accent, background, surface, text);
  }

  function sanitizeMotif(value) {
    const allowed = new Set([
      "care",
      "circuit",
      "crest",
      "custom",
      "diagonal",
      "editorial",
      "ledger",
      "level-up",
      "maze",
      "organic",
      "orbit",
      "playful",
      "quest",
      "scoreboard",
      "wave",
    ]);
    return allowed.has(value) ? value : "custom";
  }

  function sanitizeCssColor(value) {
    if (typeof value !== "string") {
      return "";
    }
    const color = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      return color.toLowerCase();
    }
    if (/^hsl\(\d{1,3} \d{1,3}% \d{1,3}%\)$/i.test(color)) {
      return color;
    }
    return "";
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
    normalizeThemeProfile,
    slugify,
  };

  global.ScormGeneratorDomain = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

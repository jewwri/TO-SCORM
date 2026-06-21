const assert = require("node:assert/strict");
const test = require("node:test");

const { createScormClient, createStoragePrefix } = require("../scorm");

function createLogger() {
  const events = [];
  return {
    events,
    info(event, metadata) {
      events.push({ level: "info", event, metadata });
    },
    warn(event, metadata) {
      events.push({ level: "warn", event, metadata });
    },
    error(event, metadata) {
      events.push({ level: "error", event, metadata });
    },
  };
}

test("uses preview mode when LMS API is unavailable", () => {
  const originalApi = globalThis.API;
  const originalLocalStorage = globalThis.localStorage;
  const logger = createLogger();
  const storage = new Map();
  delete globalThis.API;
  globalThis.localStorage = {
    getItem(key) {
      return storage.get(key) || null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
  };

  const client = createScormClient({ logger });
  assert.equal(client.init(), true);
  assert.equal(client.isPreviewMode(), true);
  assert.equal(client.set("cmi.core.lesson_location", "2"), true);
  assert.equal(client.get("cmi.core.lesson_location"), "2");
  assert.equal(logger.events.some((entry) => entry.event === "scorm_api_unavailable"), true);

  globalThis.API = originalApi;
  globalThis.localStorage = originalLocalStorage;
});

test("reports LMS set failures", () => {
  const originalApi = globalThis.API;
  const logger = createLogger();
  globalThis.API = {
    LMSInitialize() {
      return "true";
    },
    LMSGetValue() {
      return "incomplete";
    },
    LMSSetValue() {
      return "false";
    },
    LMSCommit() {
      return "true";
    },
    LMSGetLastError() {
      return "101";
    },
    LMSGetDiagnostic() {
      return "diagnostic";
    },
    LMSGetErrorString() {
      return "general exception";
    },
  };

  const client = createScormClient({ logger });
  assert.equal(client.init(), true);
  assert.equal(client.set("cmi.core.score.raw", 75), false);
  assert.equal(logger.events.some((entry) => entry.event === "scorm_set_failed"), true);

  globalThis.API = originalApi;
});

test("uses course-specific preview storage namespace", () => {
  assert.equal(createStoragePrefix("Forklift Safety!"), "forklift-safety-:");
});

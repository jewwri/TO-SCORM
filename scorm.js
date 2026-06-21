(function attachScormClient(global) {
  "use strict";

  const SCORM_TRUE = "true";
  const DEFAULT_STORAGE_NAMESPACE = "scorm";

  function createScormClient(options) {
    const config = options || {};
    const logger = config.logger || fallbackLogger();
    const storagePrefix = createStoragePrefix(config.storageNamespace);
    let api = null;
    let initialized = false;
    let previewMode = false;

    function init() {
      api = findAPI(global);
      if (!api && global.opener) {
        api = findAPI(global.opener);
      }

      if (!api) {
        previewMode = true;
        logger.warn("scorm_api_unavailable", { mode: "preview" });
        return true;
      }

      initialized = callApi("LMSInitialize", [""]) === SCORM_TRUE;
      if (!initialized) {
        logger.error("scorm_initialize_failed", readLastError());
        return false;
      }

      const existingStatus = get("cmi.core.lesson_status");
      if (!["completed", "passed", "failed"].includes(existingStatus)) {
        set("cmi.core.lesson_status", "incomplete");
      }
      commit();
      logger.info("scorm_initialized", { mode: "lms" });
      return true;
    }

    function set(key, value) {
      if (previewMode) {
        writePreviewValue(key, String(value));
        return true;
      }
      if (!initialized) {
        logger.warn("scorm_set_before_init", { key });
        return false;
      }

      const success = callApi("LMSSetValue", [key, String(value)]) === SCORM_TRUE;
      if (!success) {
        logger.error("scorm_set_failed", { key, ...readLastError() });
      }
      return success;
    }

    function get(key) {
      if (previewMode) {
        return readPreviewValue(key);
      }
      if (!initialized) {
        logger.warn("scorm_get_before_init", { key });
        return "";
      }

      const value = callApi("LMSGetValue", [key]);
      const lastError = readLastError();
      if (lastError.code && lastError.code !== "0") {
        logger.error("scorm_get_failed", { key, ...lastError });
        return "";
      }
      return value || "";
    }

    function commit() {
      if (previewMode) {
        return true;
      }
      if (!initialized) {
        logger.warn("scorm_commit_before_init", {});
        return false;
      }

      const success = callApi("LMSCommit", [""]) === SCORM_TRUE;
      if (!success) {
        logger.error("scorm_commit_failed", readLastError());
      }
      return success;
    }

    function finish() {
      if (previewMode) {
        return true;
      }
      if (!initialized) {
        return false;
      }

      commit();
      const success = callApi("LMSFinish", [""]) === SCORM_TRUE;
      initialized = false;
      if (!success) {
        logger.error("scorm_finish_failed", readLastError());
      }
      return success;
    }

    function callApi(method, args) {
      try {
        if (!api || typeof api[method] !== "function") {
          logger.error("scorm_method_missing", { method });
          return "";
        }
        return api[method].apply(api, args);
      } catch (error) {
        logger.error("scorm_call_exception", { method, message: error.message });
        return "";
      }
    }

    function readLastError() {
      if (!api || typeof api.LMSGetLastError !== "function") {
        return {};
      }

      const code = api.LMSGetLastError();
      const diagnostic =
        typeof api.LMSGetDiagnostic === "function" ? api.LMSGetDiagnostic(code) : "";
      const message =
        typeof api.LMSGetErrorString === "function" ? api.LMSGetErrorString(code) : "";
      return { code, diagnostic, message };
    }

    function writePreviewValue(key, value) {
      try {
        global.localStorage.setItem(storagePrefix + key, value);
      } catch (error) {
        logger.warn("preview_storage_write_failed", { key, message: error.message });
      }
    }

    function readPreviewValue(key) {
      try {
        return global.localStorage.getItem(storagePrefix + key) || "";
      } catch (error) {
        logger.warn("preview_storage_read_failed", { key, message: error.message });
        return "";
      }
    }

    return {
      commit,
      finish,
      get,
      init,
      set,
      isPreviewMode() {
        return previewMode;
      },
    };
  }

  function findAPI(win) {
    let currentWindow = win;
    let tries = 0;
    while (currentWindow && !currentWindow.API && currentWindow.parent && currentWindow.parent !== currentWindow && tries < 500) {
      tries += 1;
      currentWindow = currentWindow.parent;
    }
    return currentWindow && currentWindow.API ? currentWindow.API : null;
  }

  function fallbackLogger() {
    return {
      info() {},
      warn() {},
      error() {},
    };
  }

  function createStoragePrefix(namespace) {
    const configuredNamespace =
      typeof namespace === "string" && namespace.trim()
        ? namespace.trim()
        : readCourseNamespace();
    return configuredNamespace.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() + ":";
  }

  function readCourseNamespace() {
    const content = global.CourseContent;
    if (content && typeof content.courseId === "string" && content.courseId.trim()) {
      return content.courseId;
    }
    return DEFAULT_STORAGE_NAMESPACE;
  }

  const defaultLogger = global.Telemetry
    ? global.Telemetry.createLogger("scorm")
    : fallbackLogger();
  const defaultClient = createScormClient({ logger: defaultLogger });

  global.Scorm12 = { createScormClient, createStoragePrefix, findAPI };
  global.scorm = defaultClient;

  if (global.addEventListener) {
    global.addEventListener("beforeunload", defaultClient.finish);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createScormClient, createStoragePrefix, findAPI };
  }
})(typeof window !== "undefined" ? window : globalThis);

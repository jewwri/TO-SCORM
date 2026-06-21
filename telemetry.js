(function attachTelemetry(global) {
  "use strict";

  const sensitiveKeyPattern = /token|secret|password|credential|authorization|cookie/i;

  function sanitizeMetadata(metadata) {
    if (!metadata || typeof metadata !== "object") {
      return {};
    }

    return Object.entries(metadata).reduce((safe, entry) => {
      const key = entry[0];
      const value = entry[1];
      safe[key] = sensitiveKeyPattern.test(key) ? "[redacted]" : value;
      return safe;
    }, {});
  }

  function createLogger(namespace) {
    function log(level, event, metadata) {
      const payload = {
        level,
        namespace,
        event,
        metadata: sanitizeMetadata(metadata),
        timestamp: new Date().toISOString(),
      };

      if (level === "error") {
        console.error(JSON.stringify(payload));
        return;
      }
      if (level === "warn") {
        console.warn(JSON.stringify(payload));
        return;
      }
      console.info(JSON.stringify(payload));
    }

    return {
      info(event, metadata) {
        log("info", event, metadata);
      },
      warn(event, metadata) {
        log("warn", event, metadata);
      },
      error(event, metadata) {
        log("error", event, metadata);
      },
    };
  }

  const api = { createLogger, sanitizeMetadata };
  global.Telemetry = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

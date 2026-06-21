const assert = require("node:assert/strict");
const test = require("node:test");

const telemetry = require("../telemetry");

test("redacts sensitive metadata keys", () => {
  assert.deepEqual(
    telemetry.sanitizeMetadata({
      courseId: "forklift-safety",
      accessToken: "abc",
      password: "secret",
      count: 2,
    }),
    {
      courseId: "forklift-safety",
      accessToken: "[redacted]",
      password: "[redacted]",
      count: 2,
    },
  );
});

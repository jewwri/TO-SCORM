const assert = require("node:assert/strict");
const test = require("node:test");

const domain = require("../src/scorm_generator/domain/generator-domain");
const extractor = require("../src/scorm_generator/infrastructure/theme-url-extractor");

test("extracts prominent colors and metadata from fetched theme URL", async () => {
  const html = `
    <html>
      <head>
        <title>Example University Brand</title>
        <meta name="description" content="Academic brand standards" />
        <style>
          :root { --brand-blue: #002855; --brand-gold: #ffcc00; }
          .hero { color: #002855; border-color: #002855; background: #ffcc00; }
        </style>
      </head>
    </html>
  `;
  const profile = await extractor.extractThemeProfileFromUrl("https://example.edu/brand", {
    domain,
    fetchImpl: async () => ({
      ok: true,
      text: async () => html,
    }),
  });

  assert.equal(profile.name, "Academic");
  assert.equal(profile.motif, "crest");
  assert.equal(profile.colors.primary, "#002855");
  assert.equal(profile.colors.accent, "#ffcc00");
});

test("rejects non-http theme URLs", async () => {
  await assert.rejects(
    () => extractor.extractThemeProfileFromUrl("file:///tmp/theme.html", {
      domain,
      fetchImpl: async () => ({ ok: true, text: async () => "" }),
    }),
    /http or https/,
  );
});

test("ranks non-neutral hex colors", () => {
  assert.deepEqual(
    extractor.extractRankedHexColors("#ffffff #000000 #123456 #123456 #abcdef"),
    ["#123456", "#abcdef"],
  );
});

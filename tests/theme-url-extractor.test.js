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

test("falls back to reader text when direct browser fetch is blocked", async () => {
  const profile = await extractor.extractThemeProfileFromUrl("https://www.southernct.edu/", {
    domain,
    fetchImpl: async (url) => {
      if (url.startsWith("https://r.jina.ai/")) {
        return {
          ok: true,
          text: async () => "Title: Southern Connecticut State University\n\nMarkdown Content:\nA public university.",
        };
      }
      throw new Error("Failed to fetch");
    },
  });

  assert.equal(profile.name, "Academic");
  assert.equal(profile.motif, "crest");
});

test("uses linked stylesheet colors when available", async () => {
  const html = `
    <html>
      <head>
        <title>Southern Connecticut State University</title>
        <link rel="stylesheet" href="/brand.css" />
      </head>
    </html>
  `;
  const css = ":root { --blue: #003399; --olive: #99aa65; } .x { color: #003399; }";
  const profile = await extractor.extractThemeProfileFromUrl("https://www.southernct.edu/", {
    domain,
    fetchImpl: async (url) => {
      if (url === "https://www.southernct.edu/") {
        return { ok: true, text: async () => html };
      }
      if (url === "https://www.southernct.edu/brand.css") {
        return { ok: true, text: async () => css };
      }
      return { ok: false, status: 404, text: async () => "" };
    },
  });

  assert.equal(profile.name, "Academic");
  assert.equal(profile.colors.primary, "#003399");
  assert.equal(profile.colors.accent, "#99aa65");
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

test("extracts stylesheet URLs relative to the source page", () => {
  assert.deepEqual(
    extractor.extractStylesheetUrls('<link rel="stylesheet" href="/main.css">', "https://example.edu/path/"),
    ["https://example.edu/main.css"],
  );
});

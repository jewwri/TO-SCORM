(function attachThemeUrlExtractor(global) {
  "use strict";

  const MAX_HTML_BYTES = 250000;
  const HEX_COLOR_PATTERN = /#[0-9a-f]{3,6}\b/gi;

  async function extractThemeProfileFromUrl(url, dependencies) {
    const deps = dependencies || {};
    const fetchImpl = deps.fetchImpl || global.fetch;
    const domain = deps.domain || global.ScormGeneratorDomain;
    const logger = deps.logger || fallbackLogger();
    const normalizedUrl = normalizeHttpUrl(url);

    if (!fetchImpl) {
      throw new Error("Theme URL fetch is not available in this browser.");
    }
    if (!domain || typeof domain.createThemeProfile !== "function") {
      throw new Error("Theme profile generator is not available.");
    }

    const response = await fetchImpl(normalizedUrl, {
      cache: "no-store",
      mode: "cors",
    });
    if (!response.ok) {
      throw new Error("Theme URL returned HTTP " + response.status + ".");
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const pageText = extractThemeText(html, normalizedUrl);
    const baseProfile = domain.createThemeProfile(pageText);
    const colors = extractRankedHexColors(html);
    const importedProfile = {
      name: baseProfile.name === "Custom" ? "Imported" : baseProfile.name,
      motif: baseProfile.motif,
      colors: {
        primary: colors[0] || baseProfile.colors.primary,
        accent: colors[1] || baseProfile.colors.accent,
        background: baseProfile.colors.background,
        surface: baseProfile.colors.surface,
        text: baseProfile.colors.text,
      },
    };
    const safeProfile = domain.normalizeThemeProfile
      ? domain.normalizeThemeProfile(importedProfile)
      : importedProfile;

    if (!safeProfile) {
      throw new Error("Theme URL did not produce a valid theme profile.");
    }

    logger.info("theme_url_extracted", {
      hostname: new URL(normalizedUrl).hostname,
      colorCount: colors.length,
      motif: safeProfile.motif,
    });
    return safeProfile;
  }

  function normalizeHttpUrl(value) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch (_error) {
      throw new Error("Theme URL must be a valid http or https URL.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Theme URL must use http or https.");
    }
    return parsed.href;
  }

  function extractThemeText(html, url) {
    const title = extractFirstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = extractFirstMatch(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    );
    const ogSiteName = extractFirstMatch(
      html,
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    );
    const hostname = new URL(url).hostname.replace(/^www\./, "").replace(/\./g, " ");
    return [title, description, ogSiteName, hostname].filter(Boolean).join(" ");
  }

  function extractRankedHexColors(html) {
    const counts = new Map();
    Array.from(html.matchAll(HEX_COLOR_PATTERN)).forEach((match) => {
      const color = normalizeHexColor(match[0]);
      if (!color || isLowSignalColor(color)) {
        return;
      }
      counts.set(color, (counts.get(color) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .map((entry) => entry[0])
      .slice(0, 4);
  }

  function normalizeHexColor(value) {
    const hex = value.toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(hex)) {
      return "#" + hex.slice(1).split("").map((char) => char + char).join("");
    }
    if (/^#[0-9a-f]{6}$/.test(hex)) {
      return hex;
    }
    return "";
  }

  function isLowSignalColor(hex) {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
    const max = Math.max(...channels);
    const min = Math.min(...channels);
    return max < 28 || min > 238 || max - min < 18;
  }

  function extractFirstMatch(value, pattern) {
    const match = value.match(pattern);
    return match ? decodeEntities(match[1].replace(/\s+/g, " ").trim()) : "";
  }

  function decodeEntities(value) {
    return value
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function fallbackLogger() {
    return {
      info() {},
      warn() {},
      error() {},
    };
  }

  const api = {
    extractRankedHexColors,
    extractThemeProfileFromUrl,
    extractThemeText,
    normalizeHttpUrl,
  };

  global.ThemeUrlExtractor = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

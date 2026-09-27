import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The light theme was designed as a counterpart, not an inversion, so its
 * contrast has to be measured rather than assumed. This reads the real token
 * file and fails if a palette change drops a pair below its WCAG floor.
 */

type Tokens = Record<string, string>;

function readBlock(css: string, selector: string): Tokens {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing ${selector} block`);
  const end = css.indexOf("\n}", start);
  const body = css.slice(start, end);
  const tokens: Tokens = {};
  for (const match of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    tokens[`--${match[1]}`] = match[2].trim();
  }
  return tokens;
}

function resolve(value: string, tokens: Tokens, depth = 0): string {
  if (depth > 8) throw new Error(`Unresolved token chain: ${value}`);
  const reference = /^var\((--[a-z0-9-]+)\)$/.exec(value.trim());
  if (!reference) return value;
  const next = tokens[reference[1]];
  if (!next) throw new Error(`Unknown token ${reference[1]}`);
  return resolve(next, tokens, depth + 1);
}

function luminance(oklch: string): number {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(oklch);
  if (!match) throw new Error(`Not an oklch colour: ${oklch}`);
  const [l, c, h] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const cube = (value: number) => value ** 3;
  const linear = [
    4.0767416621 * cube(l + 0.3963377774 * a + 0.2158037573 * b) -
      3.3077115913 * cube(l - 0.1055613458 * a - 0.0638541728 * b) +
      0.2309699292 * cube(l - 0.0894841775 * a - 1.291485548 * b),
    -1.2684380046 * cube(l + 0.3963377774 * a + 0.2158037573 * b) +
      2.6097574011 * cube(l - 0.1055613458 * a - 0.0638541728 * b) -
      0.3413193965 * cube(l - 0.0894841775 * a - 1.291485548 * b),
    -0.0041960863 * cube(l + 0.3963377774 * a + 0.2158037573 * b) -
      0.7034186147 * cube(l - 0.1055613458 * a - 0.0638541728 * b) +
      1.707614701 * cube(l - 0.0894841775 * a - 1.291485548 * b),
  ];
  const channel = (value: number) => {
    const encoded =
      value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
    const clamped = Math.min(1, Math.max(0, encoded));
    return clamped <= 0.03928
      ? clamped / 12.92
      : ((clamped + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(linear[0]) +
    0.7152 * channel(linear[1]) +
    0.0722 * channel(linear[2])
  );
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

const css = readFileSync("src/styles/tokens.css", "utf8");
const root = readBlock(css, ":root");
const light = readBlock(css, '[data-theme="light"]');

const themes: { name: string; tokens: Tokens }[] = [
  { name: "dark", tokens: root },
  { name: "light", tokens: { ...root, ...light } },
];

const textPairs: [string, string, number][] = [
  ["--text-primary", "--surface-page", 4.5],
  ["--text-primary", "--surface-primary", 4.5],
  ["--text-primary", "--surface-elevated", 4.5],
  ["--text-secondary", "--surface-page", 4.5],
  ["--text-secondary", "--surface-elevated", 4.5],
  ["--text-muted", "--surface-page", 3],
  ["--text-muted", "--surface-primary", 3],
  ["--color-cyan-strong", "--surface-page", 4.5],
  ["--color-cyan-strong", "--surface-elevated", 4.5],
  ["--color-plasma-strong", "--surface-page", 4.5],
  ["--color-warning", "--surface-elevated", 4.5],
  ["--color-success", "--surface-elevated", 4.5],
];

describe.each(themes)("$name theme contrast", ({ tokens }) => {
  it.each(textPairs)("%s on %s meets %s:1", (foreground, background, minimum) => {
    const ratio = contrast(
      resolve(tokens[foreground], tokens),
      resolve(tokens[background], tokens),
    );
    expect(ratio).toBeGreaterThanOrEqual(minimum);
  });
});

describe("theme layer", () => {
  it("actually flips the surfaces and the foreground accents", () => {
    // A light block that only changed a comment would pass every contrast check
    // above while the toggle did nothing.
    expect(light["--surface-page"]).not.toBe(root["--surface-page"]);
    expect(light["--text-primary"]).not.toBe(root["--text-primary"]);
    expect(light["--color-cyan-strong"]).not.toBe(root["--color-cyan-strong"]);
  });

  it("keeps every dark surface darker than the light one", () => {
    for (const name of ["--surface-page", "--surface-primary", "--surface-elevated"]) {
      const dark = luminance(resolve(root[name], root));
      const daylight = luminance(resolve(light[name], { ...root, ...light }));
      expect(dark).toBeLessThan(daylight);
    }
  });
});

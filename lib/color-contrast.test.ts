import { describe, expect, it } from "vitest";

/** WCAG 2 contrast for opaque OKLCH pairs used by CRM selectors. */
const oklchToLinearSrgb = (l: number, c: number, h: number) => {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lmsL = l_ ** 3;
  const lmsM = m_ ** 3;
  const lmsS = s_ ** 3;
  return [
    4.0767416621 * lmsL - 3.3077115913 * lmsM + 0.2309699292 * lmsS,
    -1.2684380046 * lmsL + 2.6097574011 * lmsM - 0.3413193965 * lmsS,
    -0.0041960863 * lmsL - 0.7034186147 * lmsM + 1.707614701 * lmsS,
  ] as const;
};

const relativeLuminance = (l: number, c: number, h: number) => {
  const [r, g, b] = oklchToLinearSrgb(l, c, h);
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
};

const contrastRatio = (
  left: readonly [number, number, number],
  right: readonly [number, number, number],
) => {
  const first = relativeLuminance(...left);
  const second = relativeLuminance(...right);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
};

const LIGHT = {
  popover: [0.995, 0.006, 255] as const,
  foreground: [0.28, 0.025, 255] as const,
  mutedFg: [0.4, 0.025, 255] as const,
  accent: [0.9, 0.035, 255] as const,
  accentFg: [0.34, 0.05, 255] as const,
  primary: [0.88, 0.04, 255] as const,
  primaryFg: [0.36, 0.06, 255] as const,
  ring: [0.56, 0.08, 255] as const,
};

const DARK = {
  popover: [0.24, 0.02, 255] as const,
  foreground: [0.97, 0.01, 255] as const,
  mutedFg: [0.8, 0.015, 255] as const,
  accent: [0.36, 0.04, 255] as const,
  accentFg: [0.94, 0.02, 255] as const,
  primary: [0.74, 0.055, 255] as const,
  primaryFg: [0.22, 0.04, 255] as const,
  ring: [0.78, 0.06, 255] as const,
};

describe("CRM selector contrast", () => {
  it("meets WCAG AA for light overlay text", () => {
    expect(contrastRatio(LIGHT.popover, LIGHT.foreground)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(LIGHT.popover, LIGHT.mutedFg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT.accent, LIGHT.accentFg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT.primary, LIGHT.primaryFg)).toBeGreaterThanOrEqual(4.5);
  });

  it("meets WCAG AA for dark overlay text", () => {
    expect(contrastRatio(DARK.popover, DARK.foreground)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(DARK.popover, DARK.mutedFg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK.accent, DARK.accentFg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK.primary, DARK.primaryFg)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps focus rings at UI 3:1 against the overlay", () => {
    expect(contrastRatio(LIGHT.popover, LIGHT.ring)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(DARK.popover, DARK.ring)).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Continuous emotion color system — soft, flat, Morandi-inspired palette.
 *
 * Score 0-100 maps through 5 color stops:
 *   0   → Morandi Blue  #94A3B8  (subdued, calm)
 *   25  → Mint Green    #86CFAC  (soothing)
 *   50  → Warm Apricot  #E8C87A  (neutral, warm)
 *   75  → Soft Coral    #E8A87A  (warm)
 *   100 → Rose Pink     #D4849A  (intense but gentle)
 */

/** RGB tuple */
type RGB = [number, number, number];

const STOPS: { at: number; color: RGB }[] = [
  { at: 0, color: [148, 163, 184] }, // #94A3B8 Morandi Blue
  { at: 25, color: [134, 207, 172] }, // #86CFAC Mint Green
  { at: 50, color: [232, 200, 122] }, // #E8C87A Warm Apricot
  { at: 75, color: [232, 168, 122] }, // #E8A87A Soft Coral
  { at: 100, color: [212, 132, 154] }, // #D4849A Rose Pink
];

/** Linearly interpolate between two RGB colors */
function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Core: score (0-100) → RGB tuple via multi-stop gradient */
function scoreToRgb(score: number): RGB {
  const s = Math.max(0, Math.min(100, score));

  // Find the two surrounding stops
  for (let i = 0; i < STOPS.length - 1; i++) {
    const curr = STOPS[i];
    const next = STOPS[i + 1];
    if (s <= next.at) {
      const t = (s - curr.at) / (next.at - curr.at);
      return lerp(curr.color, next.color, t);
    }
  }
  return STOPS[STOPS.length - 1].color;
}

/** Convert RGB tuple to hex string */
function rgbToHex([r, g, b]: RGB): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ─── Public API (same signatures as before) ───────────────────

/** Solid fill color for cards, badges, etc. */
export function getEmotionColor(score: number): string {
  return rgbToHex(scoreToRgb(score));
}

/** Darker accent color for borders / text */
export function getEmotionAccentColor(score: number): string {
  const [r, g, b] = scoreToRgb(score);
  return rgbToHex([
    Math.round(r * 0.7),
    Math.round(g * 0.7),
    Math.round(b * 0.7),
  ]);
}

/** Background with alpha for map bubbles */
export function getEmotionBubbleBg(score: number): string {
  const [r, g, b] = scoreToRgb(score);
  return `rgba(${r},${g},${b},0.35)`;
}

/** Border color for map bubbles */
export function getEmotionBubbleBorder(score: number): string {
  const [r, g, b] = scoreToRgb(score);
  return `rgba(${r},${g},${b},0.6)`;
}

/** Human-readable label */
export function getEmotionLabel(score: number): string {
  if (score <= 20) return "Very Low";
  if (score <= 40) return "Low";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "High";
  return "Very High";
}

/** CSS gradient string for the slider track */
export function getSliderGradient(): string {
  return `linear-gradient(90deg, ${STOPS.map((s) => `${rgbToHex(s.color)} ${s.at}%`).join(", ")})`;
}

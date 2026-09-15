import Image from "next/image";
import { cn } from "@/lib/cn";
import logoMaroon from "@/public/brand/logo-maroon.png";
import logoWhite from "@/public/brand/logo-white.png";
import markMaroon from "@/public/brand/mark-maroon.png";
import markWhite from "@/public/brand/mark-white.png";
import stackedMaroon from "@/public/brand/logo-stacked-maroon.png";
import stackedWhite from "@/public/brand/logo-stacked-white.png";

/* The HAUS Living Estate logo (Ben's files, 2026-09-16, from ~/Desktop/…/Haus Living/Logo).
 *
 * ── THREE CUTS OF ONE LOGO ──────────────────────────────────────────────────────
 *   lockup   house + HAUS + LIVING ESTATE in a row  → open sidebar rail
 *   mark     the house alone                         → collapsed 64px rail
 *   stacked  house above the two text lines          → login page
 * The mark is not a separate brand asset — it is the house cropped out of the horizontal
 * lockup, which is the only way to fit a 64px rail without shrinking the text to nothing.
 *
 * ── WHY TWO IMAGES PER CUT ──────────────────────────────────────────────────────
 * The maroon ink is brand colour, not a UI token, so it does not follow the theme. On the
 * dark surfaces it drops below 2:1, and the brand set ships a white version for exactly
 * that. Both are in the DOM and CSS picks one (`dark:` is class-based via next-themes, so
 * a `<picture>` with prefers-color-scheme would ignore the in-app toggle).
 *
 * ── PNG, NOT SVG ────────────────────────────────────────────────────────────────
 * The source set is 3000×3000 rasters with no vector. These are trimmed to the artwork and
 * exported at 2× the largest size they render at. If a vector ever arrives, replace the
 * files in public/brand and this component does not change.
 */
type Variant = "lockup" | "mark" | "stacked";

const ART: Record<Variant, { light: typeof logoMaroon; dark: typeof logoWhite; height: number }> = {
  // Ben, 2026-09-16: "about half" of the first cut (36 / 32 / 112). The PNGs are still
  // exported at 2× the old sizes, so nothing needs re-cutting for these.
  lockup: { light: logoMaroon, dark: logoWhite, height: 20 },
  mark: { light: markMaroon, dark: markWhite, height: 18 },
  stacked: { light: stackedMaroon, dark: stackedWhite, height: 64 },
};

export function Brand({ variant, className }: { variant: Variant; className?: string }) {
  const { light, dark, height } = ART[variant];
  const width = (src: typeof light) => Math.round((src.width * height) / src.height);
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <Image src={light} alt="HAUS Living Estate" height={height} width={width(light)} className="dark:hidden" />
      <Image src={dark} alt="HAUS Living Estate" height={height} width={width(dark)} className="hidden dark:block" />
    </span>
  );
}

"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/* Light / dark / system. `attribute="class"` is what pairs this with
 * `@custom-variant dark (&:where(.dark, .dark *))` in globals.css — next-themes sets
 * `class="dark"` on <html> before first paint (an inline script), so there is no flash
 * of the wrong theme and no hydration mismatch (the root <html> carries
 * suppressHydrationWarning for that one attribute). Switched from the identity menu. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design system defines custom font-size utilities (text-display, text-h1…text-label)
// via @theme --text-*. Out of the box tailwind-merge doesn't know these are font sizes, so
// it lumps e.g. `text-small` together with custom text-COLOR classes like `text-text-onaccent`
// and drops one of them on merge — which silently stripped the light text off filled buttons
// (black text on the maroon button). Registering the sizes fixes the classification so a
// size and a colour can coexist.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "body", "small", "label"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

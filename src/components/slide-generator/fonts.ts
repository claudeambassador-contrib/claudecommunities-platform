export interface FontOption {
  family: string;
  category: "sans" | "serif" | "display" | "mono";
  weights: number[];
}

export const FONT_OPTIONS: FontOption[] = [
  { family: "Inter", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Geist", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Space Grotesk", category: "sans", weights: [400, 500, 600, 700] },
  { family: "DM Sans", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Outfit", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Sora", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Plus Jakarta Sans", category: "sans", weights: [400, 500, 600, 700, 800] },
  { family: "Poppins", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Montserrat", category: "sans", weights: [400, 500, 600, 700, 800] },
  { family: "Raleway", category: "sans", weights: [400, 500, 600, 700] },
  { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700] },
  { family: "Lora", category: "serif", weights: [400, 500, 600, 700] },
  { family: "Merriweather", category: "serif", weights: [400, 700] },
  { family: "Fraunces", category: "serif", weights: [400, 500, 600, 700] },
  { family: "Oswald", category: "display", weights: [400, 500, 600, 700] },
  { family: "Bebas Neue", category: "display", weights: [400] },
  { family: "Anton", category: "display", weights: [400] },
  { family: "JetBrains Mono", category: "mono", weights: [400, 500, 700] },
  { family: "Fira Code", category: "mono", weights: [400, 500, 700] },
];

const loadedFonts = new Set<string>();

export function loadFont(family: string | null | undefined): void {
  if (typeof document === "undefined") return;
  if (!family) return;
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const encoded = family.replace(/ /g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

export function loadAllFonts(): void {
  if (typeof document === "undefined") return;
  const families = FONT_OPTIONS.map((f) => f.family.replace(/ /g, "+")).join("&family=");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
  document.head.appendChild(link);
}

export function fontStack(family: string): string {
  const opt = FONT_OPTIONS.find((f) => f.family === family);
  const cat = opt?.category ?? "sans";
  const fallbacks: Record<string, string> = {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    display: "system-ui, sans-serif",
    mono: "ui-monospace, 'JetBrains Mono', 'SF Mono', monospace",
  };
  return `'${family}', ${fallbacks[cat]}`;
}

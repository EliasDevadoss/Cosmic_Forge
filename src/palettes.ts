import type { Palette, PaletteName } from "./types";

export const palettes: Record<PaletteName, Palette> = {
  "Ion Reef": {
    name: "Ion Reef",
    colors: ["#22d3ee", "#a3e635", "#f0f9ff"],
    glow: "#67e8f9",
  },
  "Solar Bloom": {
    name: "Solar Bloom",
    colors: ["#ffb703", "#fb7185", "#fff7ed"],
    glow: "#f97316",
  },
  "Ghost Signal": {
    name: "Ghost Signal",
    colors: ["#c084fc", "#5eead4", "#f8fafc"],
    glow: "#a78bfa",
  },
  "Aurora Core": {
    name: "Aurora Core",
    colors: ["#38bdf8", "#f472b6", "#bef264"],
    glow: "#e879f9",
  },
};

export const paletteList = Object.values(palettes);

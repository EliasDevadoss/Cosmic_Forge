export type PaletteName = "Ion Reef" | "Solar Bloom" | "Ghost Signal" | "Aurora Core";

export type Palette = {
  name: PaletteName;
  colors: [string, string, string];
  glow: string;
};

export type VisualSettings = {
  seed: number;
  particles: number;
  speed: number;
  bloom: number;
  warp: number;
  paused: boolean;
  cinematic: boolean;
  palette: PaletteName;
};

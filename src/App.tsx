import {
  Gauge,
  Maximize2,
  Orbit,
  Palette as PaletteIcon,
  Pause,
  Play,
  ScanLine,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { palettes, paletteList } from "./palettes";
import type { PaletteName, VisualSettings } from "./types";
import { NebulaCanvas } from "./visuals/NebulaCanvas";

const defaultSettings: VisualSettings = {
  seed: 18,
  particles: 105000,
  speed: 1,
  bloom: 0.86,
  warp: 0.78,
  paused: false,
  cinematic: true,
  palette: "Ion Reef",
};

const presets: Array<{ label: string; settings: Pick<VisualSettings, "palette" | "particles" | "speed" | "bloom" | "warp" | "cinematic"> }> = [
  {
    label: "Pulse",
    settings: { palette: "Ion Reef", particles: 105000, speed: 1.05, bloom: 0.86, warp: 0.78, cinematic: true },
  },
  {
    label: "Flare",
    settings: { palette: "Solar Bloom", particles: 130000, speed: 1.25, bloom: 1.08, warp: 0.9, cinematic: true },
  },
  {
    label: "Signal",
    settings: { palette: "Ghost Signal", particles: 92000, speed: 0.82, bloom: 0.74, warp: 0.62, cinematic: false },
  },
  {
    label: "Surge",
    settings: { palette: "Aurora Core", particles: 155000, speed: 1.35, bloom: 1.16, warp: 1, cinematic: true },
  },
];

function randomSeed() {
  return Math.floor(Math.random() * 100000);
}

export function App() {
  const [settings, setSettings] = useState<VisualSettings>(defaultSettings);
  const activePalette = palettes[settings.palette];

  const accentStyle = useMemo(
    () =>
      ({
        "--accent": activePalette.glow,
        "--swatch-a": activePalette.colors[0],
        "--swatch-b": activePalette.colors[1],
        "--swatch-c": activePalette.colors[2],
      }) as React.CSSProperties,
    [activePalette],
  );

  const setNumber = (key: "particles" | "speed" | "bloom" | "warp", value: number) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const applyPreset = (preset: (typeof presets)[number]) => {
    setSettings((current) => ({ ...current, ...preset.settings, seed: randomSeed(), paused: false }));
  };

  const setPalette = (palette: PaletteName) => {
    setSettings((current) => ({ ...current, palette, seed: randomSeed() }));
  };

  const shuffle = () => {
    const next = paletteList[Math.floor(Math.random() * paletteList.length)].name;
    setSettings((current) => ({
      ...current,
      palette: next,
      seed: randomSeed(),
      particles: 80000 + Math.floor(Math.random() * 95000),
      speed: Number((0.7 + Math.random() * 0.95).toFixed(2)),
      bloom: Number((0.62 + Math.random() * 0.7).toFixed(2)),
      warp: Number((0.42 + Math.random() * 0.7).toFixed(2)),
      paused: false,
    }));
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  };

  return (
    <main className="app-shell" style={accentStyle}>
      <NebulaCanvas settings={settings} palette={activePalette} />

      <header className="topbar" aria-label="Cosmic Forge controls">
        <div className="brand-mark">
          <Sparkles size={18} aria-hidden="true" />
          <span>Cosmic Forge</span>
        </div>
        <div className="top-actions">
          <button
            className="icon-button"
            type="button"
            title={settings.paused ? "Play" : "Pause"}
            aria-label={settings.paused ? "Play" : "Pause"}
            onClick={() => setSettings((current) => ({ ...current, paused: !current.paused }))}
          >
            {settings.paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button className="icon-button" type="button" title="Shuffle" aria-label="Shuffle" onClick={shuffle}>
            <Shuffle size={18} />
          </button>
          <button className="icon-button" type="button" title="Fullscreen" aria-label="Fullscreen" onClick={toggleFullscreen}>
            <Maximize2 size={18} />
          </button>
        </div>
      </header>

      <aside className="control-surface" aria-label="Visual settings">
        <div className="surface-head">
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span>Live Field</span>
        </div>

        <div className="preset-row" aria-label="Presets">
          {presets.map((preset) => (
            <button key={preset.label} type="button" className="preset-button" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>

        <label className="range-control">
          <span>
            <ScanLine size={15} aria-hidden="true" />
            Particles
          </span>
          <output>{Math.round(settings.particles / 1000)}k</output>
          <input
            type="range"
            min="40000"
            max="220000"
            step="5000"
            value={settings.particles}
            onChange={(event) => setNumber("particles", Number(event.target.value))}
          />
        </label>

        <label className="range-control">
          <span>
            <Orbit size={15} aria-hidden="true" />
            Motion
          </span>
          <output>{settings.speed.toFixed(2)}x</output>
          <input
            type="range"
            min="0.2"
            max="2"
            step="0.01"
            value={settings.speed}
            onChange={(event) => setNumber("speed", Number(event.target.value))}
          />
        </label>

        <label className="range-control">
          <span>
            <Sparkles size={15} aria-hidden="true" />
            Bloom
          </span>
          <output>{settings.bloom.toFixed(2)}</output>
          <input
            type="range"
            min="0.25"
            max="1.8"
            step="0.01"
            value={settings.bloom}
            onChange={(event) => setNumber("bloom", Number(event.target.value))}
          />
        </label>

        <label className="range-control">
          <span>
            <Gauge size={15} aria-hidden="true" />
            Warp
          </span>
          <output>{settings.warp.toFixed(2)}</output>
          <input
            type="range"
            min="0"
            max="1.25"
            step="0.01"
            value={settings.warp}
            onChange={(event) => setNumber("warp", Number(event.target.value))}
          />
        </label>

        <div className="toggle-row">
          <span>
            <Orbit size={15} aria-hidden="true" />
            Cinematic
          </span>
          <button
            className={`toggle-button ${settings.cinematic ? "is-on" : ""}`}
            type="button"
            role="switch"
            aria-checked={settings.cinematic}
            onClick={() => setSettings((current) => ({ ...current, cinematic: !current.cinematic }))}
          >
            <span />
          </button>
        </div>

        <div className="palette-block">
          <div className="palette-title">
            <PaletteIcon size={15} aria-hidden="true" />
            Palette
          </div>
          <div className="palette-grid">
            {paletteList.map((palette) => (
              <button
                key={palette.name}
                className={`palette-button ${palette.name === settings.palette ? "is-active" : ""}`}
                type="button"
                title={palette.name}
                aria-label={palette.name}
                onClick={() => setPalette(palette.name)}
                style={
                  {
                    "--p0": palette.colors[0],
                    "--p1": palette.colors[1],
                    "--p2": palette.colors[2],
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </aside>

      <div className="readout" aria-label="Render readout">
        <span>{settings.palette}</span>
        <span>{Math.round(settings.particles / 1000)}k</span>
        <span>{settings.cinematic ? "orbit" : "locked"}</span>
      </div>
    </main>
  );
}

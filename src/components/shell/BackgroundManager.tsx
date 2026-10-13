"use client";

import React, { useEffect, useState, useCallback } from "react";

export type BgTheme = "void-pulse" | "chess-perspective" | "deep-space" | "monochrome-pure";

const BG_STORAGE_KEY = "bpta_bg_theme";

export const BG_THEMES: { id: BgTheme; name: string; icon: string; desc: string }[] = [
  {
    id: "void-pulse",
    name: "Void Pulse (Neon Pink Glow)",
    icon: "⚡",
    desc: "Organic textured noise, specular magenta lighting & deep gradient",
  },
  {
    id: "chess-perspective",
    name: "3D Grid Horizon",
    icon: "♟️",
    desc: "Perspective checkered depth with smooth horizon fade",
  },
  {
    id: "deep-space",
    name: "Cosmic Starfield",
    icon: "🌌",
    desc: "Deep space ambient radial with multi-layered drifting stars",
  },
  {
    id: "monochrome-pure",
    name: "Pure Dark Minimal",
    icon: "⚪",
    desc: "High contrast pure black & subtle silver atmospheric wash",
  },
];

export function BackgroundManager() {
  const [currentTheme, setCurrentTheme] = useState<BgTheme>("void-pulse");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(BG_STORAGE_KEY) as BgTheme | null;
    if (saved && ["void-pulse", "chess-perspective", "deep-space", "monochrome-pure"].includes(saved)) {
      setCurrentTheme(saved);
      document.documentElement.setAttribute("data-bg-theme", saved);
    } else {
      document.documentElement.setAttribute("data-bg-theme", "void-pulse");
    }

    const handler = (e: CustomEvent<BgTheme>) => {
      if (e.detail) {
        setCurrentTheme(e.detail);
        document.documentElement.setAttribute("data-bg-theme", e.detail);
      }
    };
    window.addEventListener("bpta_change_bg" as any, handler);
    return () => window.removeEventListener("bpta_change_bg" as any, handler);
  }, []);

  return (
    <div className={`dynamic-app-background theme--${currentTheme}`} aria-hidden="true">
      {/* 1. Void Pulse SVG Texture & Gradients */}
      <div className="bg-layer bg-layer--void-pulse">
        <div className="void-pulse-surface" />
        <svg className="void-texture-svg" aria-hidden="true">
          <filter id="void-texture">
            <feTurbulence result="noise" numOctaves={3} baseFrequency="0.02" type="turbulence" />
            <feGaussianBlur result="blur" stdDeviation={1} in="noise" />
            <feSpecularLighting
              result="specular"
              lightingColor="#ff66cc"
              specularExponent={20}
              specularConstant={1}
              surfaceScale={3}
              in="blur"
            >
              <feDistantLight elevation={45} azimuth={90} />
            </feSpecularLighting>
            <feComposite result="lit" operator="over" in2="SourceGraphic" in="specular" />
            <feBlend mode="screen" in2="lit" in="SourceGraphic" />
          </filter>
        </svg>
      </div>

      {/* 2. 3D Checker Horizon Perspective */}
      <div className="bg-layer bg-layer--chess-perspective">
        <div className="chess-container">
          <div className="chess-ground" />
        </div>
      </div>

      {/* 3. Deep Space Parallax Stars */}
      <div className="bg-layer bg-layer--deep-space">
        <div className="space-container">
          <div id="stars" />
          <div id="stars2" />
          <div id="stars3" />
        </div>
      </div>

      {/* 4. Pure Black Minimal Dark Mode */}
      <div className="bg-layer bg-layer--monochrome-pure">
        <div className="monochrome-container" />
      </div>

      {/* Subtle overlay so text readability remains 100% crisp without muddy blurs */}
      <div className="bg-clarity-enhancer" />
    </div>
  );
}

/**
 * Switcher dropdown widget for topbar / settings
 */
export function BackgroundSwitcher() {
  const [theme, setTheme] = useState<BgTheme>("void-pulse");

  useEffect(() => {
    const saved = localStorage.getItem(BG_STORAGE_KEY) as BgTheme | null;
    if (saved) setTheme(saved);
  }, []);

  const handleChange = (next: BgTheme) => {
    setTheme(next);
    localStorage.setItem(BG_STORAGE_KEY, next);
    document.documentElement.setAttribute("data-bg-theme", next);
    window.dispatchEvent(new CustomEvent("bpta_change_bg", { detail: next }));
  };

  return (
    <div className="bg-theme-switcher" title="Change Background Style">
      <label htmlFor="bg-theme-select" className="sr-only">
        Theme Background
      </label>
      <div className="bg-select-wrap">
        <span className="bg-select-icon" aria-hidden="true">
          🎨
        </span>
        <select
          id="bg-theme-select"
          className="input input--sm bg-select-input"
          value={theme}
          onChange={(e) => handleChange(e.target.value as BgTheme)}
        >
          {BG_THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

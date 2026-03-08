import React from "react";
import { useVideoConfig } from "remotion";
import { Scene } from "./Scene";

interface PreviewProps {
  svgContent: string;
  drawDurationSec: number;
  morphIntensity: number;
}

/**
 * Simple wrapper to preview a single scene in Remotion Studio.
 * Useful for testing animation settings before full render.
 */
export const SingleScenePreview: React.FC<PreviewProps> = ({
  svgContent,
  drawDurationSec,
  morphIntensity,
}) => {
  const { durationInFrames } = useVideoConfig();

  // If no SVG content provided, show a demo SVG
  const content =
    svgContent ||
    `<svg viewBox="0 0 1920 1080">
      <path id="mountain1" d="M0 800 L300 400 L600 800 L900 350 L1200 800 L1500 300 L1920 800 L1920 1080 L0 1080 Z" stroke-width="2"/>
      <path id="cloud1" d="M400 250 Q450 200 500 250 Q550 200 600 250" stroke-width="1.5"/>
      <path id="cloud2" d="M1200 180 Q1250 130 1300 180 Q1350 130 1400 180" stroke-width="1.5"/>
      <path id="person" d="M960 400 Q960 350 960 320 Q940 310 950 280 Q960 250 970 280 Q980 310 960 320 M960 400 L940 500 M960 400 L980 500 M960 500 L940 650 M960 500 L980 650" stroke-width="2"/>
    </svg>`;

  return (
    <Scene
      svgContent={content}
      drawDurationSec={drawDurationSec}
      morphIntensity={morphIntensity}
      audioDurationFrames={durationInFrames}
    />
  );
};

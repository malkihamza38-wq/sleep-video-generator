import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Audio,
  staticFile,
} from "remotion";
import { evolvePath, warpPath, parsePath, serializeInstructions } from "@remotion/paths";

interface SceneProps {
  svgContent: string; // Raw SVG content with multiple paths
  drawDurationSec: number;
  morphIntensity: number; // 1-5
  audioFile?: string;
  audioDurationFrames: number;
}

interface ParsedLayer {
  d: string;
  strokeWidth: number;
  id: string;
  // Layers closer to background get more morph
  depthFactor: number;
}

/**
 * Parses SVG content and extracts all path elements with their attributes.
 * Groups paths into layers based on their position/id for independent animation.
 */
function extractPaths(svgContent: string): ParsedLayer[] {
  if (!svgContent) return [];

  const pathRegex = /<path[^>]*\bd="([^"]+)"[^>]*\/?>/gi;
  const layers: ParsedLayer[] = [];
  let match;
  let index = 0;

  while ((match = pathRegex.exec(svgContent)) !== null) {
    const fullTag = match[0];
    const d = match[1];

    // Extract stroke-width if present
    const swMatch = fullTag.match(/stroke-width="([^"]+)"/);
    const strokeWidth = swMatch ? parseFloat(swMatch[1]) : 2;

    // Extract id if present
    const idMatch = fullTag.match(/id="([^"]+)"/);
    const id = idMatch ? idMatch[1] : `path_${index}`;

    // Assign depth factor: first paths = background (more morph), last = foreground (less morph)
    layers.push({ d, strokeWidth, id, depthFactor: 0 });
    index++;
  }

  // Assign depth factors after we know total count
  const total = layers.length;
  for (let i = 0; i < total; i++) {
    // Background layers (first) get depthFactor ~1, foreground (last) get ~0.2
    layers[i].depthFactor = interpolate(i, [0, Math.max(total - 1, 1)], [1.0, 0.2]);
  }

  return layers;
}

/**
 * Extract viewBox from SVG content
 */
function extractViewBox(svgContent: string): string {
  const match = svgContent.match(/viewBox="([^"]+)"/);
  return match ? match[1] : "0 0 1920 1080";
}

/**
 * Warp a path using sinusoidal displacement for organic morphing.
 * Each layer warps independently based on its depthFactor.
 */
function warpPathOrganic(
  d: string,
  frame: number,
  intensity: number,
  depthFactor: number
): string {
  try {
    const parsed = parsePath(d);
    const amplitude = intensity * depthFactor;

    const warped = warpPath(d, ({ x, y }) => {
      const time = frame / 30; // Normalize to seconds

      // Multiple sine waves for organic feel (loopable via 2*PI period)
      const dx =
        Math.sin(y / 80 + time * 1.2) * amplitude * 1.0 +
        Math.sin(y / 40 + time * 0.8 + 1.5) * amplitude * 0.5 +
        Math.sin(x / 120 + time * 0.5) * amplitude * 0.3;

      const dy =
        Math.cos(x / 100 + time * 1.0) * amplitude * 0.6 +
        Math.cos(x / 60 + time * 0.6 + 2.0) * amplitude * 0.3;

      return { x: x + dx, y: y + dy };
    });

    return warped;
  } catch {
    return d; // Fallback to original path if warp fails
  }
}

export const Scene: React.FC<SceneProps> = ({
  svgContent,
  drawDurationSec,
  morphIntensity,
  audioFile,
  audioDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drawDurationFrames = drawDurationSec * fps;

  // Parse SVG paths once
  const layers = useMemo(() => extractPaths(svgContent), [svgContent]);
  const viewBox = useMemo(() => extractViewBox(svgContent), [svgContent]);

  // Map intensity 1-5 to pixel displacement
  const intensityPx = interpolate(morphIntensity, [1, 5], [1.5, 6]);

  // Morph loop duration in frames (for perfect looping: 4 seconds)
  const morphLoopFrames = fps * 4;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox={viewBox}
        style={{ width: "100%", height: "100%" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {layers.map((layer, i) => {
          // === PHASE 1: LINE DRAWING ===
          // Stagger each layer's drawing start slightly
          const layerDelay = (i / layers.length) * drawDurationFrames * 0.3;
          const layerDrawEnd = drawDurationFrames + layerDelay;

          const drawProgress = interpolate(
            frame,
            [layerDelay, layerDrawEnd],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.inOut(Easing.cubic),
            }
          );

          let evolveStyle = {};
          let currentPath = layer.d;

          if (drawProgress < 1) {
            // Still drawing - use evolvePath
            try {
              evolveStyle = evolvePath(drawProgress, layer.d);
            } catch {
              // Fallback: simple opacity fade
              evolveStyle = { opacity: drawProgress };
            }
          }

          // === PHASE 2: MORPHING LOOP (after drawing is complete) ===
          if (frame > drawDurationFrames) {
            const morphFrame = frame - drawDurationFrames;
            // Use modulo for perfect looping
            const loopFrame = morphFrame % morphLoopFrames;
            currentPath = warpPathOrganic(
              layer.d,
              loopFrame,
              intensityPx,
              layer.depthFactor
            );
          }

          return (
            <path
              key={layer.id}
              d={currentPath}
              stroke="white"
              fill="none"
              strokeWidth={layer.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={evolveStyle}
            />
          );
        })}
      </svg>

      {/* Audio narration */}
      {audioFile && (
        <Audio src={staticFile(audioFile)} volume={1} />
      )}
    </div>
  );
};

import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Audio,
  Img,
  staticFile,
} from "remotion";

interface SceneProps {
  imageFile: string; // Path to PNG image (relative to public/)
  drawDurationSec: number;
  morphIntensity: number; // 1-5
  audioFile?: string;
  audioDurationFrames: number;
}

export const Scene: React.FC<SceneProps> = ({
  imageFile,
  drawDurationSec,
  morphIntensity,
  audioFile,
  audioDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drawDurationFrames = drawDurationSec * fps;

  // Fade-in progress
  const opacity = interpolate(
    frame,
    [0, drawDurationFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }
  );

  // Morph animation: use feTurbulence seed that changes over time for organic movement
  // Map intensity 1-5 to displacement scale
  const displacementScale = interpolate(morphIntensity, [1, 5], [3, 15]);

  // Animate the turbulence over time for organic morphing (loop every 4 seconds)
  const morphLoopFrames = fps * 4;
  const morphTime = frame > drawDurationFrames
    ? ((frame - drawDurationFrames) % morphLoopFrames) / morphLoopFrames
    : 0;

  // Use baseFrequency animation for smooth organic motion
  const baseFreq = 0.008 + Math.sin(morphTime * Math.PI * 2) * 0.003;
  const seed = Math.floor(morphTime * 10) % 10; // Slowly changing seed

  // Scale for morph effect (only active after draw phase)
  const currentDisplacement = frame > drawDurationFrames ? displacementScale : 0;

  const filterId = `morph-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* SVG filter for organic displacement */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${baseFreq} ${baseFreq * 1.2}`}
              numOctaves={3}
              seed={seed}
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale={currentDisplacement}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <Img
        src={staticFile(imageFile)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity,
          filter: currentDisplacement > 0 ? `url(#${filterId})` : undefined,
        }}
      />

      {/* Audio narration */}
      {audioFile && (
        <Audio src={staticFile(audioFile)} volume={1} />
      )}
    </div>
  );
};

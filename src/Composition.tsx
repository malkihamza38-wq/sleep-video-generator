import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  Audio,
  staticFile,
} from "remotion";
import { Scene } from "./Scene";

interface SceneData {
  id: string;
  imageFile: string;
  audioDurationFrames: number;
  audioFile: string;
}

interface CompositionProps {
  scenes: SceneData[];
  drawDurationSec: number;
  morphIntensity: number;
  transitionType: "fade" | "cut" | "dissolve";
  transitionDurationSec: number;
}

/**
 * Fade transition overlay between scenes
 */
const FadeTransition: React.FC<{
  progress: number;
  type: "in" | "out";
}> = ({ progress, type }) => {
  const opacity = type === "out" ? progress : 1 - progress;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "black",
        opacity,
        zIndex: 10,
      }}
    />
  );
};

export const SleepVideoComposition: React.FC<CompositionProps> = ({
  scenes,
  drawDurationSec,
  morphIntensity,
  transitionType,
  transitionDurationSec,
}) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const transitionFrames = Math.round(transitionDurationSec * fps);

  // Calculate scene timing: each scene plays for its audio duration
  // with overlap for transitions
  let currentOffset = 0;
  const sceneTiming = scenes.map((scene, i) => {
    const start = currentOffset;
    const duration = scene.audioDurationFrames;
    currentOffset += duration - (i < scenes.length - 1 ? transitionFrames : 0);
    return { ...scene, startFrame: start, durationFrames: duration };
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "black",
        position: "relative",
      }}
    >
      {sceneTiming.map((scene, i) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.durationFrames}
          name={scene.id}
        >
          {/* The scene animation */}
          <Scene
            imageFile={scene.imageFile}
            drawDurationSec={drawDurationSec}
            morphIntensity={morphIntensity}
            audioFile={scene.audioFile}
            audioDurationFrames={scene.durationFrames}
          />

          {/* Fade in at start (except first scene) */}
          {transitionType === "fade" && i > 0 && (
            <Sequence durationInFrames={transitionFrames}>
              <FadeTransition
                progress={interpolate(
                  frame - scene.startFrame,
                  [0, transitionFrames],
                  [1, 0],
                  { extrapolateRight: "clamp" }
                )}
                type="in"
              />
            </Sequence>
          )}

          {/* Fade out at end (except last scene) */}
          {transitionType === "fade" && i < scenes.length - 1 && (
            <Sequence
              from={scene.durationFrames - transitionFrames}
              durationInFrames={transitionFrames}
            >
              <FadeTransition
                progress={interpolate(
                  frame - scene.startFrame - (scene.durationFrames - transitionFrames),
                  [0, transitionFrames],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )}
                type="out"
              />
            </Sequence>
          )}
        </Sequence>
      ))}

      {/* Ambient music layer */}
      <Audio
        src={staticFile("ambient-music.mp3")}
        volume={0.15}
        loop
      />
    </div>
  );
};

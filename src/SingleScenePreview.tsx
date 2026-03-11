import React from "react";
import { useVideoConfig } from "remotion";
import { Scene } from "./Scene";

interface PreviewProps {
  imageFile: string;
  drawDurationSec: number;
  morphIntensity: number;
}

/**
 * Simple wrapper to preview a single scene in Remotion Studio.
 * Useful for testing animation settings before full render.
 */
export const SingleScenePreview: React.FC<PreviewProps> = ({
  imageFile,
  drawDurationSec,
  morphIntensity,
}) => {
  const { durationInFrames } = useVideoConfig();

  return (
    <Scene
      imageFile={imageFile || ""}
      drawDurationSec={drawDurationSec}
      morphIntensity={morphIntensity}
      audioDurationFrames={durationInFrames}
    />
  );
};

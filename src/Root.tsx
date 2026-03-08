import React from "react";
import { Composition, staticFile } from "remotion";
import { SleepVideoComposition } from "./Composition";
import { SingleScenePreview } from "./SingleScenePreview";

// Default props for preview - will be overridden at render time
const defaultSceneData = [
  {
    id: "scene_01",
    svgPaths: [] as string[], // Will be loaded from SVG files
    svgContent: "", // Raw SVG content
    audioDurationFrames: 30 * 120, // 2 min placeholder
    audioFile: "",
  },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Full video composition - used for final render */}
      <Composition
        id="SleepVideo"
        component={SleepVideoComposition}
        durationInFrames={30 * 60 * 60} // Placeholder, overridden by render script
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: defaultSceneData,
          drawDurationSec: 4,
          morphIntensity: 3,
          transitionType: "fade" as const,
          transitionDurationSec: 1.5,
        }}
      />

      {/* Single scene preview - for testing individual scenes */}
      <Composition
        id="ScenePreview"
        component={SingleScenePreview}
        durationInFrames={30 * 15} // 15 sec preview
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          svgContent: "",
          drawDurationSec: 4,
          morphIntensity: 3,
        }}
      />
    </>
  );
};

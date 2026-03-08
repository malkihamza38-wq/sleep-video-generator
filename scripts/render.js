#!/usr/bin/env node

/**
 * render.js
 *
 * Final assembly: loads SVGs + audio, calculates timing, renders via Remotion.
 *
 * Usage:
 *   node scripts/render.js                     # Full render
 *   node scripts/render.js --preview 60        # Render first 60 seconds only
 *   node scripts/render.js --quality crf28     # Lower quality = faster (default: crf18)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

const SVG_DIR = path.join("output", "svg");
const VOICE_DIR = path.join("output", "voice");
const FINAL_DIR = path.join("output", "final");

// Parse CLI args
const args = process.argv.slice(2);
const previewDuration = args.includes("--preview")
  ? parseInt(args[args.indexOf("--preview") + 1])
  : null;
const quality = args.includes("--quality")
  ? args[args.indexOf("--quality") + 1]
  : "crf18";

/**
 * Get audio duration in seconds using ffprobe
 */
function getAudioDuration(audioPath) {
  const result = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`,
    { encoding: "utf-8" }
  );
  return parseFloat(result.trim());
}

function main() {
  fs.mkdirSync(FINAL_DIR, { recursive: true });

  console.log("═══════════════════════════════════════════");
  console.log("  STEP 6: Final Render (Remotion)");
  console.log("═══════════════════════════════════════════");

  // Load SVG files
  const svgFiles = fs
    .readdirSync(SVG_DIR)
    .filter((f) => f.endsWith(".svg"))
    .sort();

  if (svgFiles.length === 0) {
    console.error("❌ No SVG files found in output/svg/");
    console.error("   Run 'npm run vectorize' first.");
    process.exit(1);
  }

  // Load voice manifest
  const manifestPath = path.join(VOICE_DIR, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("❌ No voice manifest found.");
    console.error("   Run 'npm run generate-voice' first.");
    process.exit(1);
  }

  const voiceManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  // Build scene data
  const scenes = svgFiles.map((svgFile) => {
    const sceneId = svgFile.replace(".svg", "");
    const svgContent = fs.readFileSync(path.join(SVG_DIR, svgFile), "utf-8");

    // Find matching audio
    const voiceEntry = voiceManifest.find((v) => v.sceneId === sceneId);
    const audioFile = voiceEntry ? path.basename(voiceEntry.audioFile) : "";
    const durationSec = voiceEntry ? voiceEntry.durationSec : 120; // Default 2 min

    return {
      id: sceneId,
      svgContent,
      audioDurationFrames: Math.ceil(durationSec * config.video.fps),
      audioFile: audioFile ? `voice/${audioFile}` : "",
    };
  });

  // Calculate total duration
  const totalDurationFrames = scenes.reduce(
    (sum, s) => sum + s.audioDurationFrames,
    0
  );
  const totalDurationSec = totalDurationFrames / config.video.fps;

  console.log(`Scenes: ${scenes.length}`);
  console.log(`Total duration: ${formatTime(totalDurationSec)}`);
  console.log(`Quality: ${quality}`);
  if (previewDuration) {
    console.log(`Preview mode: first ${previewDuration}s only`);
  }

  // Write props file for Remotion
  const propsPath = path.join(FINAL_DIR, "props.json");
  const props = {
    scenes,
    drawDurationSec: config.scenes.drawDurationSec,
    morphIntensity: config.scenes.morphIntensity,
    transitionType: config.scenes.transitionType,
    transitionDurationSec: config.scenes.transitionDurationSec,
  };
  fs.writeFileSync(propsPath, JSON.stringify(props));

  // Copy voice files to public folder for Remotion access
  const publicVoiceDir = path.join("public", "voice");
  fs.mkdirSync(publicVoiceDir, { recursive: true });
  for (const entry of voiceManifest) {
    const src = entry.audioFile;
    const dest = path.join(publicVoiceDir, path.basename(src));
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Copy ambient music to public if it exists
  if (fs.existsSync(config.audio.ambientMusicPath)) {
    const dest = path.join("public", "ambient-music.mp3");
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(config.audio.ambientMusicPath, dest);
    }
  }

  // Determine render frames
  const renderFrames = previewDuration
    ? `0-${previewDuration * config.video.fps}`
    : `0-${totalDurationFrames}`;

  const crf = quality.replace("crf", "");
  const outputFile = path.join(
    FINAL_DIR,
    previewDuration ? "preview.mp4" : "final_video.mp4"
  );

  console.log(`\n🎬 Rendering to ${outputFile}...`);
  console.log("   This may take a while for long videos.\n");

  // Build Remotion render command
  const renderCmd = [
    "npx remotion render",
    "src/index.ts",
    "SleepVideo",
    `"${outputFile}"`,
    `--props="${propsPath}"`,
    `--codec=h264`,
    `--crf=${crf}`,
    `--frames=${renderFrames}`,
    `--concurrency=50%`, // Use half CPU cores
    `--log=verbose`,
  ].join(" ");

  console.log(`Command: ${renderCmd}\n`);

  try {
    execSync(renderCmd, { stdio: "inherit", timeout: 3600000 }); // 1h timeout

    const fileSize = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(1);

    console.log("\n═══════════════════════════════════════════");
    console.log("  ✅ RENDER COMPLETE!");
    console.log(`  File: ${path.resolve(outputFile)}`);
    console.log(`  Size: ${fileSize} MB`);
    console.log(`  Duration: ${formatTime(previewDuration || totalDurationSec)}`);
    console.log("");
    console.log("  To download:");
    console.log(`  scp -P PORT root@IP:${path.resolve(outputFile)} ~/Desktop/`);
    console.log("═══════════════════════════════════════════");
  } catch (e) {
    console.error("\n❌ Render failed:", e.message);
    process.exit(1);
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}

main();

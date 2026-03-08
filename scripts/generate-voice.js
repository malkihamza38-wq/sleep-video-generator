#!/usr/bin/env node

/**
 * generate-voice.js
 *
 * Generates voice narration using XTTS-v2 via a Python subprocess.
 * Splits your script into segments (one per scene) and generates audio for each.
 *
 * Usage:
 *   node scripts/generate-voice.js --script script.txt                    # Full generation
 *   node scripts/generate-voice.js --script script.txt --preview          # First 30 sec only
 *   node scripts/generate-voice.js --script script.txt --scene scene_03   # One scene only
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));

const VOICE_DIR = path.join("output", "voice");
const SVG_DIR = path.join("output", "svg");

// Parse CLI args
const args = process.argv.slice(2);
const scriptPath = args.includes("--script")
  ? args[args.indexOf("--script") + 1]
  : "script.txt";
const previewMode = args.includes("--preview");
const sceneFilter = args.includes("--scene")
  ? args[args.indexOf("--scene") + 1]
  : null;

/**
 * Check Python and XTTS are available
 */
function checkDependencies() {
  const result = spawnSync("python3", ["-c", "from TTS.api import TTS; print('OK')"], {
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    console.error("❌ XTTS-v2 is not installed.");
    console.error("   Install it with: pip install coqui-tts");
    process.exit(1);
  }
}

/**
 * Split script text into N segments based on scene count.
 * Uses paragraph breaks as natural split points.
 */
function splitScript(text, numScenes) {
  // Split on double newlines (paragraphs)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length <= numScenes) {
    // Fewer paragraphs than scenes: one paragraph per scene
    // Pad with empty strings if needed
    while (paragraphs.length < numScenes) {
      paragraphs.push("");
    }
    return paragraphs;
  }

  // Distribute paragraphs across scenes evenly
  const segments = [];
  const perScene = Math.ceil(paragraphs.length / numScenes);

  for (let i = 0; i < numScenes; i++) {
    const start = i * perScene;
    const end = Math.min(start + perScene, paragraphs.length);
    segments.push(paragraphs.slice(start, end).join("\n\n"));
  }

  return segments;
}

/**
 * Generate audio for a text segment using XTTS-v2 via Python
 */
function generateAudio(text, outputPath) {
  // Escape text for Python
  const escapedText = text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");

  const pythonScript = `
import sys
from TTS.api import TTS

tts = TTS("${config.voice.model}", gpu=True)
tts.tts_to_file(
    text="${escapedText}",
    file_path="${outputPath}",
    speaker_wav="${config.voice.samplePath}",
    language="${config.voice.language}"
)
print("OK")
`;

  const result = spawnSync("python3", ["-c", pythonScript], {
    encoding: "utf-8",
    stdio: "pipe",
    timeout: 300000, // 5 min max per segment
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || "XTTS generation failed");
  }

  return result.stdout.includes("OK");
}

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
  checkDependencies();
  fs.mkdirSync(VOICE_DIR, { recursive: true });

  console.log("═══════════════════════════════════════════");
  console.log("  STEP 4: Voice Generation (XTTS-v2)");
  console.log("═══════════════════════════════════════════");

  // Read script
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ Script file not found: ${scriptPath}`);
    console.error("   Create a script.txt with your narration text.");
    process.exit(1);
  }

  // Check voice sample exists
  if (!fs.existsSync(config.voice.samplePath)) {
    console.error(`❌ Voice sample not found: ${config.voice.samplePath}`);
    console.error("   Place a 6-second .wav sample in assets/voice-sample.wav");
    process.exit(1);
  }

  const scriptText = fs.readFileSync(scriptPath, "utf-8").trim();

  // Count available SVGs to determine number of scenes
  const svgFiles = fs.existsSync(SVG_DIR)
    ? fs.readdirSync(SVG_DIR).filter((f) => f.endsWith(".svg")).sort()
    : [];

  const numScenes = svgFiles.length || 25; // Default to 25 if no SVGs yet

  console.log(`Script: ${scriptPath} (${scriptText.split(/\s+/).length} words)`);
  console.log(`Scenes: ${numScenes}`);
  console.log(`Language: ${config.voice.language}`);
  console.log(`Voice sample: ${config.voice.samplePath}`);

  // Split script into segments
  const segments = splitScript(scriptText, numScenes);

  // Preview mode: only generate first segment (30 sec)
  const segmentsToGenerate = previewMode
    ? [segments[0]]
    : sceneFilter
      ? [segments[svgFiles.findIndex((f) => f.includes(sceneFilter))]]
      : segments;

  const manifest = [];

  for (let i = 0; i < segmentsToGenerate.length; i++) {
    const sceneIndex = previewMode ? 0 : sceneFilter
      ? svgFiles.findIndex((f) => f.includes(sceneFilter))
      : i;

    const sceneId = svgFiles[sceneIndex]
      ? svgFiles[sceneIndex].replace(".svg", "")
      : `scene_${String(sceneIndex + 1).padStart(2, "0")}`;

    const outputPath = path.join(VOICE_DIR, `${sceneId}.wav`);
    const segment = segmentsToGenerate[i];

    if (!segment) continue;

    // Skip if already exists
    if (fs.existsSync(outputPath) && !previewMode) {
      console.log(`⏭️  ${sceneId}: Already exists, skipping`);
      const duration = getAudioDuration(outputPath);
      manifest.push({ sceneId, audioFile: outputPath, durationSec: duration });
      continue;
    }

    console.log(`\n🎙️  ${sceneId}: Generating voice...`);
    console.log(`   Text: "${segment.substring(0, 80)}..."`);

    try {
      generateAudio(segment, outputPath);

      const duration = getAudioDuration(outputPath);
      console.log(`   ✅ Saved: ${outputPath} (${duration.toFixed(1)}s)`);
      manifest.push({ sceneId, audioFile: outputPath, durationSec: duration });
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`);
    }
  }

  // Save manifest for render step
  const manifestPath = path.join(VOICE_DIR, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("\n═══════════════════════════════════════════");
  if (previewMode) {
    console.log("  PREVIEW DONE! Listen to the sample:");
    console.log(`  ${path.resolve(VOICE_DIR)}`);
    console.log("");
    console.log("  If the voice sounds good, run without --preview");
  } else {
    console.log(`  DONE! ${manifest.length} audio segments generated`);
    console.log(
      `  Total duration: ${manifest.reduce((a, m) => a + m.durationSec, 0).toFixed(0)}s`
    );
    console.log("");
    console.log("  → Preview full video: npm run preview");
    console.log("  → Render final:       npm run render");
  }
  console.log("═══════════════════════════════════════════");
}

main();

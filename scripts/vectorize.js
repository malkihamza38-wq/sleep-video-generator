#!/usr/bin/env node

/**
 * vectorize.js
 *
 * Converts PNG images to SVG using potrace.
 * Processes only the images you kept in output/images/ after reviewing.
 * Separates paths into layers for independent animation.
 *
 * Usage:
 *   node scripts/vectorize.js
 *   node scripts/vectorize.js --threshold 180   # Adjust B/W threshold (default: 128)
 *   node scripts/vectorize.js --turdsize 5      # Filter small noise (default: 2)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const IMAGES_DIR = path.join("output", "images");
const SVG_DIR = path.join("output", "svg");

// Parse CLI args
const args = process.argv.slice(2);
const threshold = args.includes("--threshold")
  ? parseInt(args[args.indexOf("--threshold") + 1])
  : 128;
const turdsize = args.includes("--turdsize")
  ? parseInt(args[args.indexOf("--turdsize") + 1])
  : 2;

/**
 * Check that potrace is installed
 */
function checkDependencies() {
  try {
    execSync("which potrace", { stdio: "pipe" });
  } catch {
    console.error("❌ potrace is not installed.");
    console.error("   Install it with: apt-get install -y potrace");
    process.exit(1);
  }

  try {
    execSync("which convert", { stdio: "pipe" });
  } catch {
    console.error("❌ ImageMagick is not installed.");
    console.error("   Install it with: apt-get install -y imagemagick");
    process.exit(1);
  }
}

/**
 * Convert a PNG to SVG via potrace.
 * - Inverts colors (white lines on black → black on white for potrace)
 * - Traces with potrace
 * - Post-processes SVG to add layer IDs and clean up
 */
function convertToSvg(pngPath, svgPath) {
  const tmpBmp = svgPath.replace(".svg", ".bmp");

  try {
    // Step 1: Convert PNG to BMP and invert (potrace needs BMP input)
    // White-on-black → Black-on-white for potrace to trace the lines
    execSync(
      `convert "${pngPath}" -negate -threshold ${threshold} "${tmpBmp}"`,
      { stdio: "pipe" }
    );

    // Step 2: Trace with potrace
    // -s = SVG output, -t = turdsize (noise filter), -O = optimize
    execSync(
      `potrace -s -t ${turdsize} -O 0.2 --flat -o "${svgPath}" "${tmpBmp}"`,
      { stdio: "pipe" }
    );

    // Step 3: Clean up temp file
    fs.unlinkSync(tmpBmp);

    // Step 4: Post-process SVG - add viewBox, layer IDs, fix colors
    let svg = fs.readFileSync(svgPath, "utf-8");

    // Replace fill="black" with fill="white" to preserve filled shapes on black background
    svg = svg.replace(
      /fill="#000000"/g,
      'fill="white"'
    );

    // Add IDs to paths for layer-based animation
    let pathIndex = 0;
    svg = svg.replace(/<path/g, () => {
      return `<path id="layer_${pathIndex++}"`;
    });

    // Set black background via style
    svg = svg.replace(
      "<svg",
      '<svg style="background-color:black"'
    );

    fs.writeFileSync(svgPath, svg);

    return true;
  } catch (e) {
    console.error(`   ❌ Error converting ${pngPath}: ${e.message}`);
    // Clean up temp files
    if (fs.existsSync(tmpBmp)) fs.unlinkSync(tmpBmp);
    return false;
  }
}

function main() {
  checkDependencies();

  fs.mkdirSync(SVG_DIR, { recursive: true });

  console.log("═══════════════════════════════════════════");
  console.log("  STEP 2: Vectorization (PNG → SVG)");
  console.log("═══════════════════════════════════════════");
  console.log(`Threshold: ${threshold}, Turdsize: ${turdsize}`);

  // Find all scene directories
  const sceneDirs = fs
    .readdirSync(IMAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  if (sceneDirs.length === 0) {
    console.error("❌ No scene folders found in output/images/");
    console.error("   Run 'npm run generate-images' first.");
    process.exit(1);
  }

  let successCount = 0;

  for (const sceneId of sceneDirs) {
    const sceneDir = path.join(IMAGES_DIR, sceneId);

    // Find PNG files in scene directory (should be just the one you kept)
    const pngFiles = fs
      .readdirSync(sceneDir)
      .filter((f) => f.toLowerCase().endsWith(".png"));

    if (pngFiles.length === 0) {
      console.log(`⏭️  ${sceneId}: No PNG files, skipping`);
      continue;
    }

    if (pngFiles.length > 1) {
      console.log(
        `⚠️  ${sceneId}: ${pngFiles.length} PNG files found. Using first: ${pngFiles[0]}`
      );
      console.log(
        `   → Delete extras and keep only the best one for cleaner results.`
      );
    }

    const pngPath = path.join(sceneDir, pngFiles[0]);
    const svgPath = path.join(SVG_DIR, `${sceneId}.svg`);

    console.log(`\n🔄 ${sceneId}: Converting ${pngFiles[0]}...`);

    if (convertToSvg(pngPath, svgPath)) {
      const svgSize = (fs.statSync(svgPath).size / 1024).toFixed(1);
      console.log(`   ✅ Saved: ${svgPath} (${svgSize} KB)`);
      successCount++;
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  DONE! ${successCount} SVGs generated in ${SVG_DIR}`);
  console.log("");
  console.log("  → Preview animations: npm run preview");
  console.log("  → Or generate voice:  npm run generate-voice");
  console.log("═══════════════════════════════════════════");
}

main();

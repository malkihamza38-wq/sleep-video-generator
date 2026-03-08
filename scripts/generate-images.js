#!/usr/bin/env node

/**
 * generate-images.js
 *
 * Generates line-art images using Stable Diffusion A1111 API.
 * Produces multiple variants per scene so you can pick the best ones.
 *
 * Usage:
 *   node scripts/generate-images.js                    # Generate all scenes
 *   node scripts/generate-images.js --scene scene_01   # Generate one scene
 *   node scripts/generate-images.js --preview          # Generate 1 variant per scene (quick test)
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));
const prompts = JSON.parse(fs.readFileSync("prompts.json", "utf-8"));

const OUTPUT_DIR = path.join("output", "images");

// Parse CLI args
const args = process.argv.slice(2);
const sceneFilter = args.includes("--scene")
  ? args[args.indexOf("--scene") + 1]
  : null;
const previewMode = args.includes("--preview");

/**
 * Call A1111 txt2img API
 */
async function txt2img(prompt, seed = -1) {
  const fullPrompt = `${prompt} ${prompts.globalSuffix}`;
  const payload = {
    prompt: fullPrompt,
    negative_prompt: config.sdApi.negativePrompt,
    steps: config.sdApi.steps,
    cfg_scale: config.sdApi.cfgScale,
    sampler_name: config.sdApi.sampler,
    width: config.sdApi.width,
    height: config.sdApi.height,
    seed,
  };

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(`${config.sdApi.url}/sdapi/v1/txt2img`);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            resolve(json);
          } catch (e) {
            reject(new Error(`Failed to parse API response: ${e.message}`));
          }
        });
      }
    );

    req.on("error", (e) => {
      reject(
        new Error(
          `Cannot connect to A1111 API at ${config.sdApi.url}. Is it running?\n${e.message}`
        )
      );
    });

    req.write(data);
    req.end();
  });
}

async function generateScene(scene) {
  const sceneDir = path.join(OUTPUT_DIR, scene.id);
  fs.mkdirSync(sceneDir, { recursive: true });

  const variantCount = previewMode ? 1 : scene.variants || 5;

  console.log(
    `\n🎨 Generating ${variantCount} variants for ${scene.id}...`
  );
  console.log(`   Prompt: ${scene.prompt}`);

  for (let v = 0; v < variantCount; v++) {
    const seed = Math.floor(Math.random() * 2147483647);
    const outputPath = path.join(sceneDir, `variant_${v + 1}_seed${seed}.png`);

    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      console.log(`   ⏭️  Variant ${v + 1} already exists, skipping`);
      continue;
    }

    try {
      console.log(`   ⏳ Variant ${v + 1}/${variantCount} (seed: ${seed})...`);
      const result = await txt2img(scene.prompt, seed);

      if (result.images && result.images[0]) {
        const imageBuffer = Buffer.from(result.images[0], "base64");
        fs.writeFileSync(outputPath, imageBuffer);
        console.log(`   ✅ Saved: ${outputPath}`);
      } else {
        console.error(`   ❌ No image in API response`);
      }
    } catch (e) {
      console.error(`   ❌ Error: ${e.message}`);
    }
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("═══════════════════════════════════════════");
  console.log("  STEP 1: Image Generation (Stable Diffusion)");
  console.log("═══════════════════════════════════════════");
  console.log(`API: ${config.sdApi.url}`);
  console.log(`Mode: ${previewMode ? "PREVIEW (1 variant)" : "FULL"}`);

  const scenesToGenerate = sceneFilter
    ? prompts.scenes.filter((s) => s.id === sceneFilter)
    : prompts.scenes;

  if (scenesToGenerate.length === 0) {
    console.error(`No scenes found${sceneFilter ? ` matching "${sceneFilter}"` : ""}`);
    process.exit(1);
  }

  for (const scene of scenesToGenerate) {
    await generateScene(scene);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  DONE! Review your images:");
  console.log(`  ${path.resolve(OUTPUT_DIR)}`);
  console.log("");
  console.log("  → Delete the variants you don't like");
  console.log("  → Keep ONE image per scene folder");
  console.log("  → Then run: npm run vectorize");
  console.log("═══════════════════════════════════════════");
}

main().catch(console.error);

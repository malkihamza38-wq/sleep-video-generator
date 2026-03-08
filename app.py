#!/usr/bin/env python3
"""
Gradio Web Interface for Sleep Video Generator
Provides a complete UI to manage the video generation pipeline.
"""

import gradio as gr
import subprocess
import json
import os
import shutil
import glob
import time
import threading

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")
SVG_DIR = os.path.join(OUTPUT_DIR, "svg")
VOICE_DIR = os.path.join(OUTPUT_DIR, "voice")
FINAL_DIR = os.path.join(OUTPUT_DIR, "final")
CONFIG_PATH = os.path.join(PROJECT_DIR, "config.json")
PROMPTS_PATH = os.path.join(PROJECT_DIR, "prompts.json")
SCRIPT_PATH = os.path.join(PROJECT_DIR, "script.txt")


def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


def load_prompts():
    with open(PROMPTS_PATH, "r") as f:
        return json.load(f)


def save_prompts(prompts):
    with open(PROMPTS_PATH, "w") as f:
        json.dump(prompts, f, indent=2)


def load_script():
    if os.path.exists(SCRIPT_PATH):
        with open(SCRIPT_PATH, "r") as f:
            return f.read()
    return ""


def save_script(text):
    with open(SCRIPT_PATH, "w") as f:
        f.write(text)


def run_command(cmd, cwd=PROJECT_DIR):
    """Run a shell command and return output."""
    try:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd, capture_output=True, text=True, timeout=3600
        )
        output = result.stdout
        if result.stderr:
            output += "\n" + result.stderr
        return output.strip(), result.returncode == 0
    except subprocess.TimeoutExpired:
        return "Command timed out (1h limit)", False
    except Exception as e:
        return str(e), False


def check_sd_status():
    """Check if Stable Diffusion A1111 is running."""
    config = load_config()
    url = config["sdApi"]["url"]
    try:
        import urllib.request
        req = urllib.request.urlopen(f"{url}/sdapi/v1/sd-models", timeout=3)
        return True
    except Exception:
        return False


# ─── Tab 1: Scene Management ─────────────────────────────────────────────────


def get_scenes_info():
    """Get current scenes from prompts.json."""
    prompts = load_prompts()
    lines = []
    for i, scene in enumerate(prompts["scenes"]):
        lines.append(f"**{scene['id']}**: {scene['prompt']}")
    return "\n\n".join(lines)


def update_prompts(prompts_text):
    """Update prompts.json from text input."""
    try:
        data = json.loads(prompts_text)
        save_prompts(data)
        return "Prompts saved!"
    except json.JSONDecodeError as e:
        return f"Invalid JSON: {e}"


def update_script(script_text):
    """Save script.txt."""
    save_script(script_text)
    return "Script saved!"


# ─── Tab 2: Images ───────────────────────────────────────────────────────────


def get_scene_folders():
    """List scene folders."""
    prompts = load_prompts()
    return [s["id"] for s in prompts["scenes"]]


def upload_image(files, scene_id):
    """Upload images to a scene folder."""
    if not files or not scene_id:
        return "Select a scene and upload files.", get_all_images()

    scene_dir = os.path.join(IMAGES_DIR, scene_id)
    os.makedirs(scene_dir, exist_ok=True)

    count = 0
    for f in files:
        fname = os.path.basename(f)
        if not fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            continue
        # Convert non-PNG to PNG
        dest = os.path.join(scene_dir, fname)
        if not fname.lower().endswith(".png"):
            dest = os.path.splitext(dest)[0] + ".png"
            subprocess.run(
                ["convert", f, dest], capture_output=True
            )
        else:
            shutil.copy2(f, dest)
        count += 1

    return f"Uploaded {count} image(s) to {scene_id}", get_all_images()


def get_all_images():
    """Get all images across all scenes for gallery."""
    images = []
    if not os.path.exists(IMAGES_DIR):
        return images
    for scene_id in sorted(os.listdir(IMAGES_DIR)):
        scene_dir = os.path.join(IMAGES_DIR, scene_id)
        if not os.path.isdir(scene_dir):
            continue
        for img in sorted(os.listdir(scene_dir)):
            if img.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                images.append((os.path.join(scene_dir, img), scene_id))
    return images


def delete_image(gallery, evt: gr.SelectData):
    """Delete selected image from gallery."""
    if gallery and evt.index < len(gallery):
        img_path = gallery[evt.index][0]
        if os.path.exists(img_path):
            os.remove(img_path)
            return f"Deleted: {os.path.basename(img_path)}", get_all_images()
    return "No image selected", get_all_images()


def generate_sd_images(scene_id, preview_mode):
    """Generate images via Stable Diffusion."""
    if not check_sd_status():
        return "Stable Diffusion is NOT running. Start it first or upload images manually.", get_all_images()

    cmd = "npm run generate-images"
    if scene_id and scene_id != "All scenes":
        cmd += f" -- --scene {scene_id}"
    if preview_mode:
        cmd += " -- --preview"

    output, success = run_command(cmd)
    status = "Generation complete!" if success else "Generation failed."
    return f"{status}\n\n```\n{output}\n```", get_all_images()


def generate_test_image(scene_id):
    """Generate a simple test image with ImageMagick."""
    if not scene_id:
        return "Select a scene first.", get_all_images()

    scene_dir = os.path.join(IMAGES_DIR, scene_id)
    os.makedirs(scene_dir, exist_ok=True)

    dest = os.path.join(scene_dir, "test_image.png")

    # Simple line-art stick figure on black background
    cmd = (
        f'convert -size 1920x1080 xc:black '
        f'-fill none -stroke white -strokewidth 2 '
        f'-draw "circle 960,300 960,400" '
        f'-draw "line 960,400 960,650" '
        f'-draw "line 960,650 850,850" '
        f'-draw "line 960,650 1070,850" '
        f'-draw "line 960,480 830,600" '
        f'-draw "line 960,480 1090,600" '
        f'"{dest}"'
    )
    output, success = run_command(cmd)
    if success:
        return f"Test image created for {scene_id}", get_all_images()
    return f"Failed: {output}", get_all_images()


# ─── Tab 3: Vectorize ────────────────────────────────────────────────────────


def run_vectorize(threshold, turdsize):
    """Run vectorization step."""
    cmd = f"node scripts/vectorize.js --threshold {int(threshold)} --turdsize {int(turdsize)}"
    output, success = run_command(cmd)
    svgs = get_svg_files()
    return f"{'Done!' if success else 'Failed.'}\n\n```\n{output}\n```", svgs


def get_svg_files():
    """List generated SVG files."""
    if not os.path.exists(SVG_DIR):
        return "No SVGs generated yet."
    files = sorted(glob.glob(os.path.join(SVG_DIR, "*.svg")))
    if not files:
        return "No SVGs generated yet."
    lines = []
    for f in files:
        size = os.path.getsize(f) / 1024
        lines.append(f"- {os.path.basename(f)} ({size:.1f} KB)")
    return "\n".join(lines)


def preview_svg(scene_id):
    """Read SVG content for preview."""
    svg_path = os.path.join(SVG_DIR, f"{scene_id}.svg")
    if os.path.exists(svg_path):
        with open(svg_path, "r") as f:
            return f.read()
    return None


# ─── Tab 4: Voice ────────────────────────────────────────────────────────────


def run_generate_voice(preview_mode):
    """Run voice generation."""
    cmd = "node scripts/generate-voice.js --script script.txt"
    if preview_mode:
        cmd += " --preview"
    output, success = run_command(cmd)
    audio_files = get_voice_files()
    return f"{'Done!' if success else 'Failed.'}\n\n```\n{output}\n```", audio_files


def get_voice_files():
    """List generated voice files."""
    if not os.path.exists(VOICE_DIR):
        return []
    files = sorted(glob.glob(os.path.join(VOICE_DIR, "*.wav")))
    return files


def get_voice_info():
    """Get voice generation status."""
    manifest_path = os.path.join(VOICE_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        return "No voice files generated yet."
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    lines = []
    total = 0
    for entry in manifest:
        lines.append(f"- {entry['sceneId']}: {entry['durationSec']:.1f}s")
        total += entry["durationSec"]
    lines.append(f"\n**Total: {total:.0f}s ({total/60:.1f} min)**")
    return "\n".join(lines)


# ─── Tab 5: Render ────────────────────────────────────────────────────────────


def run_render(preview_seconds, quality):
    """Run final render."""
    cmd = "node scripts/render.js"
    if preview_seconds and int(preview_seconds) > 0:
        cmd += f" --preview {int(preview_seconds)}"
    if quality:
        cmd += f" --quality {quality}"
    output, success = run_command(cmd)

    video_path = None
    if preview_seconds and int(preview_seconds) > 0:
        p = os.path.join(FINAL_DIR, "preview.mp4")
    else:
        p = os.path.join(FINAL_DIR, "final_video.mp4")
    if os.path.exists(p):
        video_path = p

    return f"{'Done!' if success else 'Failed.'}\n\n```\n{output}\n```", video_path


# ─── Tab 6: Config ───────────────────────────────────────────────────────────


def get_config_text():
    config = load_config()
    return json.dumps(config, indent=2)


def save_config_text(text):
    try:
        config = json.loads(text)
        save_config(config)
        return "Config saved!"
    except json.JSONDecodeError as e:
        return f"Invalid JSON: {e}"


# ─── Build UI ─────────────────────────────────────────────────────────────────


def create_app():
    prompts_data = load_prompts()
    config = load_config()
    scene_ids = [s["id"] for s in prompts_data["scenes"]]

    with gr.Blocks(
        title="Sleep Video Generator",
    ) as app:
        gr.Markdown("# Sleep Video Generator")
        gr.Markdown("Complete pipeline: Images → Vectorize → Voice → Render")

        # Status bar
        with gr.Row():
            sd_status = gr.Markdown(
                value=f"**Stable Diffusion:** {'Running' if check_sd_status() else 'Not running (upload images manually)'}"
            )

        with gr.Tabs():
            # ─── TAB 1: SCENES & SCRIPT ──────────────────────────────────
            with gr.Tab("1. Scenes & Script", id="scenes"):
                with gr.Row():
                    with gr.Column():
                        gr.Markdown("### Scene Prompts")
                        gr.Markdown("Edit the JSON below to modify scenes and prompts.")
                        prompts_editor = gr.Code(
                            value=json.dumps(prompts_data, indent=2),
                            language="json",
                            label="prompts.json",
                            lines=20,
                        )
                        save_prompts_btn = gr.Button("Save Prompts", variant="primary")
                        prompts_status = gr.Markdown()

                    with gr.Column():
                        gr.Markdown("### Narration Script")
                        gr.Markdown("Write your narration text. Separate scenes with blank lines.")
                        script_editor = gr.Textbox(
                            value=load_script(),
                            label="script.txt",
                            lines=20,
                            placeholder="Write your narration here...\n\nSeparate paragraphs with blank lines.\n\nEach paragraph will be assigned to a scene.",
                        )
                        save_script_btn = gr.Button("Save Script", variant="primary")
                        script_status = gr.Markdown()

                save_prompts_btn.click(update_prompts, inputs=[prompts_editor], outputs=[prompts_status])
                save_script_btn.click(update_script, inputs=[script_editor], outputs=[script_status])

            # ─── TAB 2: IMAGES ────────────────────────────────────────────
            with gr.Tab("2. Images", id="images"):
                gr.Markdown("### Upload or Generate Images")
                gr.Markdown("Upload your own line-art images (white on black, PNG) or generate with Stable Diffusion.")

                with gr.Row():
                    with gr.Column(scale=1):
                        gr.Markdown("#### Upload Images")
                        scene_selector = gr.Dropdown(
                            choices=scene_ids,
                            label="Target Scene",
                            value=scene_ids[0] if scene_ids else None,
                        )
                        file_upload = gr.File(
                            label="Upload Images (PNG/JPG)",
                            file_count="multiple",
                            file_types=["image"],
                        )
                        upload_btn = gr.Button("Upload to Scene", variant="primary")
                        upload_status = gr.Markdown()

                        gr.Markdown("---")
                        gr.Markdown("#### Quick Test Image")
                        test_scene = gr.Dropdown(
                            choices=scene_ids,
                            label="Scene for test image",
                            value=scene_ids[0] if scene_ids else None,
                        )
                        test_btn = gr.Button("Generate Test Image (ImageMagick)")
                        test_status = gr.Markdown()

                        gr.Markdown("---")
                        gr.Markdown("#### Stable Diffusion")
                        sd_scene = gr.Dropdown(
                            choices=["All scenes"] + scene_ids,
                            label="Scene to generate",
                            value="All scenes",
                        )
                        sd_preview = gr.Checkbox(label="Preview mode (1 variant only)", value=True)
                        sd_btn = gr.Button("Generate with SD")
                        sd_status = gr.Markdown()

                    with gr.Column(scale=2):
                        gr.Markdown("#### Image Gallery")
                        gr.Markdown("Click an image and press 'Delete Selected' to remove it. Keep ONE per scene.")
                        image_gallery = gr.Gallery(
                            value=get_all_images(),
                            label="Scene Images",
                            columns=3,
                            height=500,
                            object_fit="contain",
                        )
                        with gr.Row():
                            delete_btn = gr.Button("Delete Selected Image", variant="stop")
                            refresh_btn = gr.Button("Refresh Gallery")
                        delete_status = gr.Markdown()

                selected_idx = gr.State(value=None)

                def on_select(evt: gr.SelectData):
                    return evt.index

                image_gallery.select(on_select, outputs=[selected_idx])

                def do_delete(gallery, idx):
                    if idx is not None and gallery and idx < len(gallery):
                        img_path = gallery[idx][0]
                        if os.path.exists(img_path):
                            os.remove(img_path)
                            return f"Deleted: {os.path.basename(img_path)}", get_all_images(), None
                    return "No image selected", get_all_images(), None

                upload_btn.click(
                    upload_image,
                    inputs=[file_upload, scene_selector],
                    outputs=[upload_status, image_gallery],
                )
                test_btn.click(
                    generate_test_image,
                    inputs=[test_scene],
                    outputs=[test_status, image_gallery],
                )
                sd_btn.click(
                    generate_sd_images,
                    inputs=[sd_scene, sd_preview],
                    outputs=[sd_status, image_gallery],
                )
                delete_btn.click(
                    do_delete,
                    inputs=[image_gallery, selected_idx],
                    outputs=[delete_status, image_gallery, selected_idx],
                )
                refresh_btn.click(
                    lambda: get_all_images(),
                    outputs=[image_gallery],
                )

            # ─── TAB 3: VECTORIZE ─────────────────────────────────────────
            with gr.Tab("3. Vectorize", id="vectorize"):
                gr.Markdown("### PNG → SVG Conversion")
                gr.Markdown("Converts your selected images to SVG for animation. Make sure you have exactly ONE image per scene folder.")

                with gr.Row():
                    with gr.Column(scale=1):
                        threshold_slider = gr.Slider(
                            minimum=50, maximum=250, value=128, step=1,
                            label="Threshold (black/white cutoff)"
                        )
                        turdsize_slider = gr.Slider(
                            minimum=0, maximum=20, value=2, step=1,
                            label="Turdsize (noise filter)"
                        )
                        vectorize_btn = gr.Button("Run Vectorize", variant="primary", size="lg")
                        vectorize_output = gr.Markdown()

                    with gr.Column(scale=2):
                        svg_list = gr.Markdown(value=get_svg_files(), label="Generated SVGs")

                vectorize_btn.click(
                    run_vectorize,
                    inputs=[threshold_slider, turdsize_slider],
                    outputs=[vectorize_output, svg_list],
                )

            # ─── TAB 4: VOICE ─────────────────────────────────────────────
            with gr.Tab("4. Voice", id="voice"):
                gr.Markdown("### Voice Narration (Kokoro TTS)")
                gr.Markdown("Generates audio narration from your script.txt. Make sure you saved your script in Tab 1.")

                with gr.Row():
                    with gr.Column(scale=1):
                        voice_config = load_config()
                        gr.Markdown(f"**Language:** {voice_config['voice']['language']}")
                        gr.Markdown(f"**Voice:** {voice_config['voice']['kokoroVoice']}")
                        voice_preview = gr.Checkbox(label="Preview mode (first segment only)", value=True)
                        voice_btn = gr.Button("Generate Voice", variant="primary", size="lg")
                        voice_output = gr.Markdown()
                        voice_info = gr.Markdown(value=get_voice_info())

                    with gr.Column(scale=2):
                        gr.Markdown("#### Audio Preview")
                        voice_audio = gr.Audio(label="Preview audio", type="filepath")

                        def get_first_voice():
                            files = get_voice_files()
                            return files[0] if files else None

                        voice_refresh = gr.Button("Refresh Audio List")

                        @gr.render(inputs=[], triggers=[voice_refresh.click, voice_btn.click])
                        def render_voice_files():
                            files = get_voice_files()
                            if files:
                                for f in files:
                                    gr.Audio(value=f, label=os.path.basename(f))

                voice_btn.click(
                    run_generate_voice,
                    inputs=[voice_preview],
                    outputs=[voice_output, gr.State()],
                ).then(
                    lambda: get_voice_info(),
                    outputs=[voice_info],
                ).then(
                    get_first_voice,
                    outputs=[voice_audio],
                )

            # ─── TAB 5: RENDER ────────────────────────────────────────────
            with gr.Tab("5. Render", id="render"):
                gr.Markdown("### Final Video Render")
                gr.Markdown("Assembles SVGs + audio into the final MP4 video.")

                with gr.Row():
                    with gr.Column(scale=1):
                        render_preview = gr.Number(
                            label="Preview (seconds, 0 = full render)",
                            value=30,
                            precision=0,
                        )
                        render_quality = gr.Radio(
                            choices=["crf18", "crf23", "crf28"],
                            label="Quality (lower CRF = better quality, slower)",
                            value="crf23",
                        )
                        render_btn = gr.Button("Render Video", variant="primary", size="lg")
                        render_output = gr.Markdown()

                    with gr.Column(scale=2):
                        gr.Markdown("#### Output Video")
                        video_output = gr.Video(label="Rendered Video")

                        # Check for existing video
                        existing_preview = os.path.join(FINAL_DIR, "preview.mp4")
                        existing_final = os.path.join(FINAL_DIR, "final_video.mp4")
                        if os.path.exists(existing_preview):
                            video_output.value = existing_preview
                        elif os.path.exists(existing_final):
                            video_output.value = existing_final

                        download_btn = gr.Button("Download Video")

                render_btn.click(
                    run_render,
                    inputs=[render_preview, render_quality],
                    outputs=[render_output, video_output],
                )

            # ─── TAB 6: CONFIG ────────────────────────────────────────────
            with gr.Tab("Config", id="config"):
                gr.Markdown("### Configuration")
                config_editor = gr.Code(
                    value=get_config_text(),
                    language="json",
                    label="config.json",
                    lines=25,
                )
                save_config_btn = gr.Button("Save Config", variant="primary")
                config_status = gr.Markdown()

                save_config_btn.click(
                    save_config_text,
                    inputs=[config_editor],
                    outputs=[config_status],
                )

    return app


if __name__ == "__main__":
    app = create_app()
    app.launch(
        server_name="0.0.0.0",
        server_port=7861,
        share=True,
    )

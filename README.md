# AICompress

AICompress is an offline desktop and command-line utility for shrinking video
and image files while protecting visual quality. Media stays on the local
machine throughout the workflow.

## What it does

- Accepts any video container FFmpeg can read, and PNG, JPEG, WebP, GIF, and
  SVG images.
- Provides a quality-first target reduction control from 50% through 99%.
- Uses modern codecs where the container and source permit it.
- Preserves the original file and writes output to a user-selected location.
- Runs as a Tauri desktop application on macOS, Windows, and Linux.
- Includes a headless Linux command for servers and terminal workflows.

## Supported formats

Video input covers the containers FFmpeg can demux, including MP4, MOV, MKV,
WebM, AVI, M4V, MPG, MPEG, TS, M2TS, MTS, WMV, ASF, FLV, F4V, 3GP, OGV, VOB,
MXF, DV, RM, and Y4M.

Video output is written to MP4, MOV, MKV, WebM, AVI, or GIF. A source in one
of those containers keeps it by default. Every other source is re-containered
to MP4, because FFmpeg reads many formats it cannot sensibly write. The output
container is shown in the extension control before compression starts and can
be changed there.

Image input and output cover PNG, JPEG, WebP, GIF, and SVG.

The reduction percentage is a best-case goal, not a guaranteed output size.
AICompress stops pursuing a target when doing so would violate its quality
safeguards. Results vary with source codec, dimensions, frame rate, motion,
noise, and audio content.

## Desktop development

For complete macOS setup and launch instructions, see
[INSTALLATION.md](INSTALLATION.md).

Requirements:

- Node.js 22.13 or newer
- pnpm
- Rust and the platform prerequisites required by Tauri 2

Install and start the application:

```bash
pnpm install
pnpm tauri:dev
```

Build a distributable application:

```bash
pnpm tauri:build
```

Build products are written below `src-tauri/target/release/bundle/` (or the
selected cross-compilation target directory).

## Linux command line

The headless command has no mandatory Python dependencies:

```bash
python3 scripts/aicompress_linux.py input.mp4
```

The root-level compatibility command is also available:

```bash
python3 compress_linux.py input.mp4
```

Choose the output path and quality:

```bash
python3 scripts/aicompress_linux.py input.mp4 \
  --output output.mp4 \
  --quality 82 \
  --overwrite
```

AICompress first checks explicitly configured tools, then the host `PATH`, an
optional `imageio-ffmpeg` installation, and finally its bundled Linux
executables. Override a tool when necessary:

```bash
AICOMPRESS_FFMPEG=/opt/ffmpeg/bin/ffmpeg \
  python3 scripts/aicompress_linux.py input.mp4
```

On hosts where the bundled FFmpeg needs a newer GLIBC, install a compatible
system FFmpeg or use:

```bash
python3 -m pip install --user -r requirements-linux.txt
```

In one reference run, a 61.7 MiB video was reduced to 12.6 MiB (79.6% saved).
Results are source-dependent and should be evaluated for acceptable visual and
audio quality.

## Validation

```bash
pnpm biome:check
pnpm vite:build
cd src-tauri && cargo test
```

## Licensing

AICompress is distributed under the GNU Affero General Public License,
AGPL-3.0-only. See `LICENSE`, `NOTICE.md`, and `THIRD_PARTY_NOTICES.md` for the
applicable terms, attribution, and bundled dependency notices.

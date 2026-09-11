#!/usr/bin/env python3
"""Run AICompress from a Linux terminal without opening the desktop UI.

This intentionally has no Python package dependencies.  It drives the same
encoder programs that are bundled with the desktop application and falls back
to tools installed on PATH when a bundled binary is not compatible with the
host Linux distribution.
"""

from __future__ import annotations

import argparse
import os
import platform
import re
import shutil
import subprocess
import sys
import uuid
from pathlib import Path


# Containers FFmpeg can demux.  Input is deliberately wider than the set of
# containers that can be written; an input outside VIDEO_OUTPUT_EXTENSIONS is
# re-containered into DEFAULT_VIDEO_OUTPUT_EXTENSION.
VIDEO_EXTENSIONS = {
    "3g2", "3gp", "asf", "avi", "divx", "dv", "f4v", "flv", "m2t", "m2ts",
    "m2v", "m4v", "mjpeg", "mkv", "mod", "mov", "mp4", "mpe", "mpeg", "mpg",
    "mts", "mxf", "ogm", "ogv", "qt", "rm", "rmvb", "swf", "tod", "ts", "vob",
    "webm", "wmv", "y4m", "yuv",
}
VIDEO_OUTPUT_EXTENSIONS = {"avi", "mkv", "mov", "mp4", "webm"}
DEFAULT_VIDEO_OUTPUT_EXTENSION = "mp4"
IMAGE_EXTENSIONS = {"gif", "jpeg", "jpg", "png", "svg", "webp"}
SUPPORTED_EXTENSIONS = VIDEO_EXTENSIONS | IMAGE_EXTENSIONS

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
BIN_DIRECTORY = REPOSITORY_ROOT / "src-tauri" / "bin"


class CompressionError(RuntimeError):
    """A user-facing compression failure."""


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compress one video or image without starting the AICompress GUI."
        ),
    )
    parser.add_argument("input", type=Path, help="input media file")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="output path (default: <name>.compressed.<extension>)",
    )
    parser.add_argument(
        "-q",
        "--quality",
        type=int,
        default=75,
        metavar="1-100",
        help="output quality; higher means better quality and a larger file",
    )
    parser.add_argument(
        "--lossless",
        action="store_true",
        help="use lossless compression (PNG and WebP only)",
    )
    parser.add_argument(
        "--keep-metadata",
        action="store_true",
        help="preserve metadata instead of stripping it",
    )
    parser.add_argument(
        "-f",
        "--overwrite",
        action="store_true",
        help="replace the output file if it already exists",
    )
    arguments = sys.argv[1:]
    # pnpm/npm users commonly insert `--` before script arguments.
    if arguments[:1] == ["--"]:
        arguments = arguments[1:]
    return parser.parse_args(arguments)


def bundled_tool_path(name: str) -> Path | None:
    machine = platform.machine().lower()
    if machine not in {"amd64", "x86_64"}:
        return None
    return BIN_DIRECTORY / f"aicompress_{name}-x86_64-unknown-linux-gnu"


def tool_is_usable(path: Path, version_argument: str) -> bool:
    try:
        result = subprocess.run(
            [str(path), version_argument],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
            check=False,
        )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def imageio_ffmpeg_path() -> Path | None:
    try:
        import imageio_ffmpeg
    except ImportError:
        return None

    try:
        return Path(imageio_ffmpeg.get_ffmpeg_exe())
    except RuntimeError:
        return None


def find_tool(name: str, *, required: bool = True) -> Path | None:
    environment_name = f"AICOMPRESS_{name.upper()}"
    candidates: list[Path] = []

    configured_path = os.environ.get(environment_name)
    if configured_path:
        candidates.append(Path(configured_path).expanduser())

    system_path = shutil.which(name)
    if system_path:
        candidates.append(Path(system_path))

    if name == "ffmpeg":
        imageio_path = imageio_ffmpeg_path()
        if imageio_path:
            candidates.append(imageio_path)

    bundled_path = bundled_tool_path(name)
    if bundled_path:
        candidates.append(bundled_path)

    version_argument = "-version" if name in {"ffmpeg", "ffprobe"} else "--version"
    for candidate in candidates:
        if candidate.is_file() and tool_is_usable(candidate, version_argument):
            return candidate

    if not required:
        return None

    raise CompressionError(
        f"No usable {name} executable was found. Install {name} on the Linux "
        f"host or set {environment_name}=/absolute/path/to/{name}. The bundled "
        "binary may require a newer GLIBC than this host provides. For FFmpeg "
        "without root access, run: python3 -m pip install --user imageio-ffmpeg"
    )


def temporary_output_path(output_path: Path) -> Path:
    token = uuid.uuid4().hex[:8]
    return output_path.with_name(
        f".{output_path.stem}.aicompress-{token}{output_path.suffix}"
    )


def run(command: list[str]) -> None:
    printable_command = " ".join(
        f"'{argument}'" if " " in argument else argument for argument in command
    )
    print(f"Running: {printable_command}", file=sys.stderr)
    try:
        subprocess.run(command, check=True)
    except FileNotFoundError as error:
        raise CompressionError(f"Unable to start {command[0]}: {error}") from error
    except subprocess.CalledProcessError as error:
        raise CompressionError(
            f"Compression process exited with status {error.returncode}."
        ) from error


def video_crf(quality: int) -> int:
    # Match the desktop application's useful compression range (36..24).
    return 36 - ((36 - 24) * quality // 100)


def vp9_crf(quality: int) -> int:
    # VP9 commonly uses a wider CRF range than H.264.
    return round(45 - ((quality - 1) * 30 / 99))


def detect_video_codec(ffmpeg: Path, input_path: Path) -> str | None:
    result = subprocess.run(
        [str(ffmpeg), "-hide_banner", "-i", str(input_path)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    match = re.search(r"Video:\s*([^,\s]+)", result.stderr)
    return match.group(1).lower() if match else None


def compress_video(
    input_path: Path,
    output_path: Path,
    extension: str,
    quality: int,
    keep_metadata: bool,
) -> None:
    ffmpeg = find_tool("ffmpeg")
    assert ffmpeg is not None

    command = [
        str(ffmpeg),
        "-hide_banner",
        "-y",
        "-i",
        str(input_path),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
    ]

    if extension == "webm":
        command.extend(
            [
                "-c:v",
                "libvpx-vp9",
                "-crf",
                str(vp9_crf(quality)),
                "-b:v",
                "0",
                "-c:a",
                "libopus",
                "-b:a",
                "96k",
            ]
        )
    else:
        source_codec = detect_video_codec(ffmpeg, input_path)
        video_encoder = "libx265" if source_codec == "hevc" else "libx264"
        command.extend(
            [
                "-c:v",
                video_encoder,
                "-preset",
                "medium",
                "-crf",
                str(video_crf(quality)),
                "-c:a",
                "libmp3lame" if extension == "avi" else "aac",
                "-b:a",
                "128k",
            ]
        )
        if video_encoder == "libx265" and extension in {"mov", "mp4"}:
            command.extend(["-tag:v", "hvc1"])

    command.extend(["-map_metadata", "0" if keep_metadata else "-1"])
    if extension in {"mov", "mp4"}:
        command.extend(["-movflags", "+faststart"])
    command.append(str(output_path))
    run(command)


def compress_png_with_pngquant(
    pngquant: Path,
    input_path: Path,
    output_path: Path,
    quality: int,
    keep_metadata: bool,
) -> None:
    minimum_quality = max(0, quality - 20)
    command = [
        str(pngquant),
        "--force",
        "--output",
        str(output_path),
        "--quality",
        f"{minimum_quality}-{quality}",
        "--speed",
        "3",
    ]
    if not keep_metadata:
        command.append("--strip")
    command.append(str(input_path))
    run(command)


def compress_jpeg_with_jpegoptim(
    jpegoptim: Path,
    input_path: Path,
    output_path: Path,
    quality: int,
    keep_metadata: bool,
) -> None:
    shutil.copyfile(input_path, output_path)
    command = [
        str(jpegoptim),
        "--force",
        f"--max={quality}",
        "--all-progressive",
    ]
    if not keep_metadata:
        command.append("--strip-all")
    command.append(str(output_path))
    run(command)


def compress_image_with_ffmpeg(
    input_path: Path,
    output_path: Path,
    extension: str,
    quality: int,
    lossless: bool,
    keep_metadata: bool,
) -> None:
    ffmpeg = find_tool("ffmpeg")
    assert ffmpeg is not None

    command = [
        str(ffmpeg),
        "-hide_banner",
        "-y",
        "-i",
        str(input_path),
        "-map_metadata",
        "0" if keep_metadata else "-1",
    ]

    if extension in {"jpg", "jpeg"}:
        jpeg_quality = round(2 + ((100 - quality) * 18 / 99))
        command.extend(["-frames:v", "1", "-q:v", str(jpeg_quality)])
    elif extension == "png":
        command.extend(
            ["-frames:v", "1", "-c:v", "png", "-compression_level", "9"]
        )
    elif extension == "webp":
        command.extend(
            [
                "-frames:v",
                "1",
                "-c:v",
                "libwebp",
                "-quality",
                str(quality),
            ]
        )
        if lossless:
            command.extend(["-lossless", "1"])
    elif extension == "gif":
        color_count = round(32 + ((quality - 1) * 224 / 99))
        filters = (
            "[0:v]split[original][palette_input];"
            f"[palette_input]palettegen=max_colors={color_count}:"
            "stats_mode=diff[palette];"
            "[original][palette]paletteuse=dither=sierra2_4a:"
            "diff_mode=rectangle"
        )
        command.extend(["-filter_complex", filters, "-loop", "0"])
    else:
        raise CompressionError(f"Unsupported image format: {extension}")

    command.append(str(output_path))
    run(command)


def compress_image(
    input_path: Path,
    output_path: Path,
    extension: str,
    quality: int,
    lossless: bool,
    keep_metadata: bool,
) -> None:
    if extension == "svg":
        raise CompressionError(
            "Headless SVG compression is not available yet. Use the AICompress "
            "desktop application for SVG input."
        )

    if extension == "png" and not lossless:
        pngquant = find_tool("pngquant", required=False)
        if pngquant:
            compress_png_with_pngquant(
                pngquant,
                input_path,
                output_path,
                quality,
                keep_metadata,
            )
            return

    if extension in {"jpg", "jpeg"}:
        jpegoptim = find_tool("jpegoptim", required=False)
        if jpegoptim:
            compress_jpeg_with_jpegoptim(
                jpegoptim,
                input_path,
                output_path,
                quality,
                keep_metadata,
            )
            return

    compress_image_with_ffmpeg(
        input_path,
        output_path,
        extension,
        quality,
        lossless,
        keep_metadata,
    )


def target_extension_for(extension: str) -> str:
    """Extension the output is written with.

    Video containers that cannot be written are re-containered into MP4.
    Images always keep their format.
    """
    if extension in VIDEO_EXTENSIONS and extension not in VIDEO_OUTPUT_EXTENSIONS:
        return DEFAULT_VIDEO_OUTPUT_EXTENSION
    return extension


def output_for_input(input_path: Path, target_extension: str) -> Path:
    return input_path.with_name(
        f"{input_path.stem}.compressed.{target_extension}"
    )


def validate_arguments(
    arguments: argparse.Namespace,
) -> tuple[Path, Path, str, str]:
    if not sys.platform.startswith("linux"):
        raise CompressionError("This command-line entry point is for Linux.")

    input_path = arguments.input.expanduser().resolve()
    if not input_path.is_file():
        raise CompressionError(f"Input file does not exist: {input_path}")

    if not 1 <= arguments.quality <= 100:
        raise CompressionError("--quality must be between 1 and 100.")

    extension = input_path.suffix.lower().lstrip(".")
    if extension not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise CompressionError(
            f"Unsupported input extension '.{extension}'. Supported: {supported}"
        )

    if arguments.lossless and extension not in {"png", "webp"}:
        raise CompressionError("--lossless is supported only for PNG and WebP.")

    target_extension = target_extension_for(extension)
    output_path = (
        arguments.output.expanduser().resolve()
        if arguments.output
        else output_for_input(input_path, target_extension)
    )
    output_extension = output_path.suffix.lower().lstrip(".")
    if output_extension != target_extension:
        if target_extension == extension:
            raise CompressionError(
                "The input and output extensions must match. Format conversion "
                "is not enabled in this Linux CLI."
            )
        raise CompressionError(
            f"'.{extension}' cannot be written back, so the output must be "
            f"'.{target_extension}'."
        )
    if output_path == input_path:
        raise CompressionError("Input and output paths must be different.")
    if output_path.exists() and not arguments.overwrite:
        raise CompressionError(
            f"Output already exists: {output_path}. Use --overwrite to replace it."
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    return input_path, output_path, extension, target_extension


def human_size(size: int) -> str:
    value = float(size)
    for unit in ("B", "KiB", "MiB", "GiB"):
        if value < 1024 or unit == "GiB":
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} GiB"


def main() -> int:
    arguments = parse_arguments()
    temporary_path: Path | None = None

    try:
        input_path, output_path, extension, target_extension = validate_arguments(
            arguments
        )
        temporary_path = temporary_output_path(output_path)

        print(f"Input:  {input_path}")
        print(f"Output: {output_path}")

        if extension in VIDEO_EXTENSIONS:
            compress_video(
                input_path,
                temporary_path,
                target_extension,
                arguments.quality,
                arguments.keep_metadata,
            )
        else:
            compress_image(
                input_path,
                temporary_path,
                extension,
                arguments.quality,
                arguments.lossless,
                arguments.keep_metadata,
            )

        if not temporary_path.is_file() or temporary_path.stat().st_size == 0:
            raise CompressionError("The encoder did not produce a valid output file.")

        input_size = input_path.stat().st_size
        output_size = temporary_path.stat().st_size
        if output_size >= input_size:
            raise CompressionError(
                "The encoded file is not smaller than the input. Retry with a "
                "lower --quality value; the existing output was not replaced."
            )

        temporary_path.replace(output_path)
        saving = (
            ((input_size - output_size) / input_size) * 100 if input_size else 0.0
        )

        print(f"Created: {output_path}")
        print(
            f"Size: {human_size(input_size)} -> {human_size(output_size)} "
            f"({saving:.1f}% saved)"
        )
        return 0
    except CompressionError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


if __name__ == "__main__":
    raise SystemExit(main())

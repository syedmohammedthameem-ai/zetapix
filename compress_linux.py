#!/usr/bin/env python3
"""Compatibility entry point for the AICompress Linux command."""

from pathlib import Path
import runpy


COMMAND = Path(__file__).resolve().parent / "scripts" / "aicompress_linux.py"
runpy.run_path(str(COMMAND), run_name="__main__")

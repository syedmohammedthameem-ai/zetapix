# AICompress Installation and Launch Guide

This guide starts from a clean macOS installation and covers every dependency
needed to install, launch, and build AICompress. It applies to Apple Silicon
and Intel Macs.

## 1. Install macOS Command Line Tools

Open the Terminal application and run:

```bash
xcode-select --install
```

If macOS reports that the tools are already installed, continue.

## 2. Install Homebrew

Run the official Homebrew installer:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Homebrew may ask for your macOS login password. Configure it for the current
Terminal session:

```bash
if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi
```

Make Homebrew available in future Terminal sessions. Use the Apple Silicon
command on M-series Macs:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
```

On an Intel Mac, replace `/opt/homebrew/bin/brew` with
`/usr/local/bin/brew`.

## 3. Install Node.js, pnpm, and Rust

Install Node.js 22, the Rust installer, and pnpm:

```bash
brew install node@22 rustup-init
brew link --overwrite --force node@22
rustup-init -y
source "$HOME/.cargo/env"
npm install --global pnpm
```

Verify all tools:

```bash
node --version
pnpm --version
rustc --version
cargo --version
```

Node.js must be version `22.13` or newer within the Node 22 release line.

## 4. Install AICompress dependencies

Change to the project directory:

```bash
cd /Users/syedmohammedthameem/Downloads/compression-main
```

Install the exact dependency versions from the lockfile:

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

The `--ignore-scripts` option is required for this repository because its
current install hook runs `fnm use`, but the project does not include a
`.node-version` or `.nvmrc` file. This option skips lifecycle hooks only; all
dependencies needed to build and launch the application are installed.

## 5. Validate the installation

Run the TypeScript check:

```bash
pnpm tsc:check
```

Build the frontend:

```bash
pnpm vite:build
```

Both commands should finish without errors. The frontend build creates the
`dist/` directory.

## 6. Launch the desktop application

From the project directory, run:

```bash
pnpm tauri:dev
```

This starts the Vite development server on port `3001`, compiles the Rust
backend, and opens the native AICompress window. Keep this Terminal window
open while using the development application.

The first launch may take several minutes while Rust dependencies compile.
Later launches are faster because Cargo reuses its build cache.

Stop the development application with `Ctrl+C` in the running Terminal.

## 7. Build the macOS application

Build for an Apple Silicon Mac:

```bash
pnpm tauri:build:mac:arm64
```

Build for an Intel Mac:

```bash
pnpm tauri:build:mac:x64
```

Or use the general build command for the current machine:

```bash
pnpm tauri:build
```

Build products are placed below:

```text
src-tauri/target/release/bundle/
```

The macOS application is normally in:

```text
src-tauri/target/release/bundle/macos/
```

Open the generated application with:

```bash
open src-tauri/target/release/bundle/macos/*.app
```

Build both macOS architectures with:

```bash
pnpm tauri:build:mac
```

## Useful commands

Run the frontend without the native Tauri shell:

```bash
pnpm vite:dev
```

Run Rust tests:

```bash
cd src-tauri
cargo test
```

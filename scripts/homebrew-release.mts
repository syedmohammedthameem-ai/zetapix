#!/usr/bin/env node
/** biome-ignore-all lint/suspicious/noConsole: <> */

/**
 * Homebrew Cask release script for AICompress.
 *
 * This script generates Homebrew cask files for both architectures
 *
 * Output: Generates Homebrew cask files in ./homebrew directory
 */

import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Types
interface Config {
  version: string
  appName: string
  author: string
  repo: string
  arm64DmgPath: string
  x64DmgPath: string
  homebrewOutputDir: string
  homebrewCaskFile: string
  homebrewTemplateFile: string
}

interface Checksums {
  arm64: string
  x64: string
}

// ANSI color codes
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  reset: '\x1b[0m',
}

function log(message: string): void {
  console.log(message)
}

function logGreen(message: string): void {
  log(`${colors.green}${message}${colors.reset}`)
}

function logRed(message: string): void {
  log(`${colors.red}${message}${colors.reset}`)
}

function logYellow(message: string): void {
  log(`${colors.yellow}${message}${colors.reset}`)
}

/**
 * Get the version from package.json
 */
function getVersion(): string {
  const packageJsonPath = path.join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  return packageJson.version
}

/**
 * Initialize configuration
 */
function initConfig(version: string): Config {
  const appName = 'AICompress'
  const [author = '', repo = ''] = (
    process.env.AICOMPRESS_GITHUB_REPOSITORY ?? ''
  ).split('/')
  if (!author || !repo) {
    throw new Error(
      'Set AICOMPRESS_GITHUB_REPOSITORY=owner/repository before creating a cask.',
    )
  }
  const homebrewOutputDir = path.join(__dirname, '..', 'homebrew')

  return {
    version,
    appName,
    author,
    repo,
    arm64DmgPath: path.join(
      __dirname,
      '..',
      'src-tauri',
      'target',
      'aarch64-apple-darwin',
      'release',
      'bundle',
      'dmg',
      `${appName}_${version}_aarch64.dmg`,
    ),
    x64DmgPath: path.join(
      __dirname,
      '..',
      'src-tauri',
      'target',
      'x86_64-apple-darwin',
      'release',
      'bundle',
      'dmg',
      `${appName}_${version}_x64.dmg`,
    ),
    homebrewOutputDir,
    homebrewCaskFile: path.join(homebrewOutputDir, 'aicompress.rb'),
    homebrewTemplateFile: path.join(
      homebrewOutputDir,
      'aicompress.rb.template',
    ),
  }
}

/**
 * Check if a file exists
 */
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

/**
 * Calculate SHA256 checksum of a file
 */
function calculateSha256(filePath: string): string {
  const hash = crypto.createHash('sha256')
  const fileBuffer = fs.readFileSync(filePath)
  hash.update(fileBuffer as any)
  return hash.digest('hex')
}

/**
 * Read and parse the template file
 */
function readTemplate(templatePath: string): string {
  if (!fileExists(templatePath)) {
    throw new Error(`Template file not found at ${templatePath}`)
  }
  return fs.readFileSync(templatePath, 'utf-8')
}

/**
 * Replace placeholders in template
 */
function replacePlaceholders(
  template: string,
  version: string,
  author: string,
  repo: string,
  arm64Sha256: string,
  x64Sha256: string,
): string {
  let content = template
  content = content.replace(/\{\{VERSION\}\}/g, version)
  content = content.replace(/\{\{REPOSITORY_OWNER\}\}/g, author)
  content = content.replace(/\{\{REPOSITORY_NAME\}\}/g, repo)
  content = content.replace(/\{\{ARM64_SHA256\}\}/g, arm64Sha256)
  content = content.replace(/\{\{X64_SHA256\}\}/g, x64Sha256)
  return content
}

/**
 * Write content to a file
 */
function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf-8')
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Generate checksums file content
 */
function generateChecksumsContent(
  version: string,
  checksums: Checksums,
): string {
  return `AICompress v${version} Checksums
================================

ARM64 (Apple Silicon):
  File: AICompress_${version}_aarch64.dmg
  SHA256: ${checksums.arm64}

Intel (x86_64):
  File: AICompress_${version}_x64.dmg
  SHA256: ${checksums.x64}
`
}

/**
 * Main function
 */
function main(): void {
  logGreen('=== Homebrew Cask Release Script ===')

  const version = getVersion()
  logYellow(`Version: ${version}`)
  log('')

  const config = initConfig(version)

  // Check if DMG files exist
  logGreen('Checking for DMG files...')

  if (!fileExists(config.arm64DmgPath)) {
    logRed(`Error: ARM64 DMG not found at ${config.arm64DmgPath}`)
    log(
      'Please build the ARM64 version first using: npm run tauri:build -- --target aarch64-apple-darwin',
    )
    process.exit(1)
  }

  if (!fileExists(config.x64DmgPath)) {
    logRed(`Error: x64 DMG not found at ${config.x64DmgPath}`)
    log(
      'Please build the x64 version first using: npm run tauri:build -- --target x86_64-apple-darwin',
    )
    process.exit(1)
  }

  logGreen('✓ ARM64 DMG found')
  logGreen('✓ x64 DMG found')
  log('')

  // Calculate SHA256 checksums
  logGreen('Calculating SHA256 checksums...')
  const arm64Sha256 = calculateSha256(config.arm64DmgPath)
  const x64Sha256 = calculateSha256(config.x64DmgPath)

  logYellow(`ARM64 SHA256: ${arm64Sha256}`)
  logYellow(`x64 SHA256: ${x64Sha256}`)
  log('')

  // Create Homebrew cask directories
  ensureDir(config.homebrewOutputDir)
  const casksDir = path.join(config.homebrewOutputDir, 'casks')
  ensureDir(casksDir)

  // Read template
  const template = readTemplate(config.homebrewTemplateFile)

  // Generate cask content
  logGreen('Generating Homebrew cask file from template...')
  const caskContent = replacePlaceholders(
    template,
    version,
    config.author,
    config.repo,
    arm64Sha256,
    x64Sha256,
  )

  // Write main cask file
  writeFile(config.homebrewCaskFile, caskContent)
  logGreen(`✓ Main cask file generated: ${config.homebrewCaskFile}`)

  // Write versioned backup
  const versionedCaskFile = path.join(casksDir, `aicompress-${version}.rb`)
  const versionedCaskContent = caskContent.replace(
    'cask "aicompress"',
    `cask "aicompress@${version}"`,
  )
  writeFile(versionedCaskFile, versionedCaskContent)
  logGreen(`✓ Versioned backup created: ${versionedCaskFile}`)
  log('')

  // Generate checksums file
  const checksumsFile = path.join(config.homebrewOutputDir, 'checksums.txt')
  const checksumsContent = generateChecksumsContent(version, {
    arm64: arm64Sha256,
    x64: x64Sha256,
  })
  writeFile(checksumsFile, checksumsContent)
  logGreen(`✓ Checksum file generated: ${checksumsFile}`)
  log('')

  // Display the cask file content
  logGreen('=== Generated Cask File ===')
  log(caskContent)
  log('')
}

try {
  main()
} catch (error) {
  if (error instanceof Error) {
    logRed(`Error: ${error.message}`)
    process.exit(1)
  } else {
    logRed('Unknown error occurred')
    process.exit(1)
  }
}

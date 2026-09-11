export interface GitHubRelease {
  tag_name: string
  html_url: string
  assets: Array<{
    name: string
    browser_download_url: string
  }>
}

const REPOSITORY = import.meta.env.PUBLIC_GITHUB_REPOSITORY?.trim()
const [REPO_OWNER, REPO_NAME] = REPOSITORY?.split('/') ?? []
const FALLBACK_VERSION = '3.0.0'

function repositoryUrl(): string | undefined {
  if (!REPO_OWNER || !REPO_NAME) return undefined
  return `https://github.com/${REPO_OWNER}/${REPO_NAME}`
}

/**
 * Fetch the latest release from GitHub
 * This runs at build time, so there's no runtime API call from the client
 */
export async function getLatestRelease(): Promise<GitHubRelease> {
  const sourceUrl = repositoryUrl()
  if (!sourceUrl) {
    return { tag_name: FALLBACK_VERSION, html_url: '#downloads', assets: [] }
  }

  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
  )

  if (!response.ok) {
    if (import.meta.env.PROD) {
      throw new Error('Failed to fetch latest release from GitHub.')
    }
    return {} as any
  }

  return response.json()
}

/**
 * Generate download URL for a specific asset
 */
export function getDownloadUrl(version: string, assetName: string): string {
  const sourceUrl = repositoryUrl()
  return sourceUrl
    ? `${sourceUrl}/releases/download/${version}/${assetName}`
    : `/downloads/${assetName}`
}

/**
 * Download asset types
 */
export interface DownloadAssets {
  version: string
  mac: {
    aarch64: string
    x64: string
  }
  linux: {
    appImage: string
    deb: string
  }
  windows: {
    x64: string
  }
}

/**
 * Get all download URLs for the current version
 */
export function getDownloadAssets(version: string): DownloadAssets {
  return {
    version,
    mac: {
      aarch64: getDownloadUrl(version, `AICompress_${version}_aarch64.dmg`),
      x64: getDownloadUrl(version, `AICompress_${version}_x64.dmg`),
    },
    linux: {
      appImage: getDownloadUrl(version, `AICompress_${version}_amd64.AppImage`),
      deb: getDownloadUrl(version, `AICompress_${version}_amd64.deb`),
    },
    windows: {
      x64: getDownloadUrl(version, `AICompress_${version}_x64.exe`),
    },
  }
}

export async function fetchGitHubStars(): Promise<number | undefined> {
  if (!REPO_OWNER || !REPO_NAME) return undefined

  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
  )

  if (!response.ok) {
    if (import.meta.env.PROD) {
      throw new Error('Failed to fetch latest stars from GitHub.')
    }
    return undefined
  }

  const data = await response.json()
  const stars = data.stargazers_count
  return stars
}

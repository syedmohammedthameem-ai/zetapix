# AICompress changelog

## Unreleased

- Established the AICompress product identity across application metadata,
  bundle identifiers, sidecars, release tooling, and user-facing content.
- Added a quality-first target reduction control with a best-case range of
  50% to 99%.
- Widened video input to every container FFmpeg can demux. Sources that cannot
  be written back are re-containered to MP4.
- Replaced content sniffing with extension-based media typing, so containers
  the sniffer does not recognise are no longer rejected as corrupt.
- Restricted source-codec reuse to codecs FFmpeg can encode, so a VC-1, WMV 9,
  or RealVideo source now falls back to the container default instead of
  failing with an unknown encoder.
- Registered file associations and Linux MIME types for the additional
  containers, and corrected the QuickTime MIME type.
- Added bitrate safeguards so aggressive size targets do not silently force
  unusable video quality.
- Added a headless Linux compression command with system-tool and bundled-tool
  discovery.
- Added a Windows build pipeline that runs on a Windows runner and produces
  the NSIS installer and MSI, fetching the FFmpeg sidecars at build time.
- Disabled automatic updates until an AICompress release endpoint and signing
  key are configured.

Historical development attribution is recorded in `NOTICE.md`; this changelog
tracks AICompress-specific work only.

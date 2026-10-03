# Concentavo 1.1.0-rc.3

This desktop release candidate brings the latest web editor improvements to Mac and Windows.

- Separate soprano/alto and tenor/bass on shared staves, including scores that mix stacked notes with sparse voice numbers. Choose automatic, written or two-to-four-part separation per staff.
- Remove or restore parts after import. Renaming a part immediately updates the Show selector.
- Share passages between parts with bar ranges and octave shifts, and show shared choir lyrics in tenor and bass views.
- Start in Simple mode; switch to Advanced for detailed settings.
- Use more of the screen for notation, enlarge scores on large displays, and reserve lyric spacing on narrow displays.
- Keep Follow and scrolling direction accessible in landscape. Follow playback gradually, resume four seconds after manual scrolling, and stay off when disabled.

Existing desktop rooms and settings keep their storage location. This release includes both Apple Silicon and Intel Mac downloads, a Windows x64 installer, matching source and SHA-256 checksums. Installers bundle the runtime and GitHub sign-in helper.

These are technical beta builds. They are not publisher-signed or notarized; macOS and Windows may show security warnings. Browser and desktop smoke tests run on the supported operating systems, but fresh installation, end-to-end updater installation and real GitHub publishing require native release verification. See docs/RELEASE.md for the remaining checks.

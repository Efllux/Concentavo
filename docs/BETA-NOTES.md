# Concentavo 1.1.0-beta.4

Concentavo turns MusicXML and MIDI into independent choir rehearsal websites. This beta adds a room sidebar, Dutch, dark mode, sample-based piano, chord-symbol playback, editable publishing parts, conditional octave doubling, responsive score flow, piece defaults, folders/tags, bulk actions, bar seeking/loops, encrypted password-protected exports and automatic update support. Singers do not need an account.

Installers bundle the runtime and GitHub sign-in helper. These development builds are not publisher-signed or notarized; macOS and Windows may show security warnings.

macOS downloads are now separated into Apple Silicon and Intel packages, substantially reducing both download and installed size. Choose Apple Silicon for M-series Macs and Intel for older Macs. The desktop package currently retains English and Dutch Chromium resources; more application languages can be added without redesigning the translation system.

This update gives the recorded piano 30 sample points and studio, mellow and bright choices. Count-in is saved with piece defaults, folder tabs have a colour bar and an Edit folder context action, and sparse voice-number changes in OCR MusicXML join the main melody. Imported page positioning is removed so the score can reflow to the current screen.

Browser regression and encryption/tamper checks passed locally. Both reported private scores import and render in the new interface. Native Windows installation, fresh macOS installation, and real GitHub publishing still need release verification. Publishing tests currently use mocks.

The source archive, licences and checksums accompany the builds. See docs/RELEASE.md for the checklist before publishing a public beta.

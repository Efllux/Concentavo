# Concentavo 1.1.0-rc.1

Concentavo turns MusicXML and MIDI into independent choir rehearsal websites. This release candidate includes a room sidebar, Dutch, dark mode, sample-based piano, chord-symbol playback, editable publishing parts, conditional octave doubling, responsive score flow, piece defaults, folders/tags, bulk actions, bar seeking/loops, encrypted password-protected exports and automatic update checks. Singers do not need an account.

Installers bundle the runtime and GitHub sign-in helper. These development builds are not publisher-signed or notarized; macOS and Windows may show security warnings.

macOS downloads are now separated into Apple Silicon and Intel packages, substantially reducing both download and installed size. Choose Apple Silicon for M-series Macs and Intel for older Macs. The desktop package currently retains English and Dutch Chromium resources; more application languages can be added without redesigning the translation system.

This update gives the recorded piano 30 sample points and studio, mellow and bright choices. Count-in is saved with piece defaults, folder tabs have a colour bar and an Edit folder context action, and sparse voice-number changes in OCR MusicXML join the main melody. Imported page positioning is removed so the score can reflow to the current screen.

Recorded piano notes now sustain through their written duration. The desktop app checks for updates after launch and every six hours, shows the result in Help, and installs downloaded updates on quit.

Browser regression and encryption/tamper checks passed for the previous beta. Both reported private scores import and render in the new interface. Native Windows installation, fresh macOS installation, automatic update installation, and real GitHub publishing still need release verification. Publishing tests currently use mocks.

The source archive, licences and checksums accompany the builds. See docs/RELEASE.md for the checklist before publishing a public beta.

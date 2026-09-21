# Changelog

## 1.1.0-beta.1

- Rename the product to Concentavo while retaining legacy local storage and backup compatibility.
- Add the app room sidebar, dark mode, globe language picker and direct folder editing.
- Add recorded Salamander piano samples and MusicXML harmony playback.
- Add publishing controls per part, piece defaults, responsive sideways score flow and conditional octave doubling.
- Add GitHub Releases update plumbing for packaged macOS and Windows builds.

## 1.1.0-beta.1 — development beta

- Rebuild the interface around a fixed score workspace and compact parts mixer, informed by Recitavo.
- Rename visible projects to libraries; add folders, folder management, coloured/frequent tags, draggable ordering and bulk actions.
- Review imported metadata and part names before saving; move editing into Piece settings and editable mixer names.
- Restore the previous mix when Focus is toggled off. Add Voice/Instrument types and seven synthesized sound choices.
- Remove imported page-layout whitespace, add measure-click seeking and loop selection, and yield auto-follow to manual scrolling.
- Replace author-assigned readiness statuses with visible/hidden/locked publishing controls. Personal progress stays optional and browser-local.
- Encrypt locked exported music using AES-256-GCM and PBKDF2; support shared library passwords and per-piece overrides. Hide excluded pieces in every export/publish path.
- Prepare AGPL source distribution, portable browser/crypto tests, native smoke tests and draft beta workflows.

Both reported private scores pass the revised import/render/scroll checks; the earlier import error itself was not reproduced. Cross-device accounts and direct Semibreva scanning are future work.

## 1.0.0 — local development build

Initial desktop app, MusicXML/MXL and MIDI import, rehearsal playback, self-contained HTML/WAV export, local backups and GitHub Pages publishing.

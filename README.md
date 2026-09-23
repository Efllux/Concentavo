# Concentavo

A local-first desktop app for turning MusicXML and MIDI into self-contained choir rehearsal websites. Organise music into independent rehearsal rooms, adjust parts, then publish to GitHub Pages. Singers need only a browser, without an account.

Concentavo is in development beta; see [release verification](docs/RELEASE.md), [the revision checklist](docs/BETA-PLAN.md), and [research notes](docs/RESEARCH.md).

## Quick start

1. Install and open the app. Choose **New rehearsal room** or try the example scores.
2. **Import scores**. Review the title, composer, folder, tags and part names before confirming.
3. Open a piece. Click part names to edit them, choose Voice or Instrument, and pick sounds.
4. Choose **Publish website** to connect GitHub and publish, or **Export files instead** for an offline ZIP.

No Node, Python, MIDI software or separate GitHub installation is required by singers or desktop users. Importing, playback and export work offline. GitHub publishing requires internet access.

## Practising

- **Focus** brings a part forward; clicking again restores the previous mix. S solos a part and M mutes it.
- Click a score measure to seek. Choose **Select loop**, then click the first and last measures. The numeric bar controls also work with a keyboard.
- **Follow score** tracks playback. Manual scrolling leaves the control on but pauses movement for four seconds. Turning it off keeps it off.
- Choose **Sideways** for a continuous score strip. Phones held horizontally choose this automatically unless a previous preference was saved.
- Playback stays visible while the score scrolls. On phones, **Parts** opens the mixer above the transport.
- Speed, pitch, count-in and repeat controls are next to playback. **My practice** holds optional local progress, private notes and playback caveats.
- Studio, mellow and bright pianos use 30 bundled Salamander Grand Piano recordings. Organ, flute, strings, soft tone and choir ah/oo remain synthesized timbres. WAV export uses the same samples, sound engine and current mix.

Space plays/pauses, arrows seek five seconds, and Home restarts when focus is outside editable controls. Bar buttons and Go to bar provide keyboard access to score seeking.

## Rehearsal rooms, folders and tags

Each rehearsal room has its own folders, colours, pieces and independent practice website. Use coloured folder tabs and tags to organise pieces; frequently used tags appear above the list. Sort by custom order, title, composer, newest or folder. Piece settings holds title, composer, folder, tags, notes and visibility. Double-click a folder name or its colour bar, or right-click and choose Edit folder, to rename, recolour or remove it without deleting its pieces.

Drag a piece's handle to reorder, or focus the handle and press Up/Down. Libraries can be dragged or moved with Alt + Up/Down. Select checkboxes for bulk move, show, hide, lock and remove. Removed scores go to Recently removed and can be restored.

Data saves automatically on the computer. **Back up room** saves an editable `.concentavo` file. Restore adds a separate rehearsal room. Old `.choirloom` backups remain supported. Keep backups: local browser or app data is not a cloud backup.

## Visibility and passwords

Visible pieces are included in the next export. Hidden pieces remain in the authoring app and are omitted from HTML and website exports. Password protection is for sharing a published piece, not for locking the editable score inside the app. Protected exports use AES-256-GCM; the room listing still shows title, composer, tags and part/bar counts.

Use the default room sharing password or choose a per-piece password in Piece settings. Four characters is accepted, and there is no confirmation field. Passwords are held only in memory until the app closes and are never included in HTML or backups. The authoring app and backups retain editable, unencrypted scores.

Changing visibility or a password changes newly exported files. It cannot revoke copies already downloaded. GitHub repositories also retain earlier versions in Git history; encrypt before first publication when that matters.

## Sharing and local progress

Direct publishing uses the bundled official GitHub CLI for browser sign-in and the GitHub REST API for updates. Tokens are encrypted with operating-system storage and excluded from exports. The app creates and updates its own website repositories using an ownership marker; it does not take over unrelated repositories.

The exported ZIP contains `index.html` and `.nojekyll`. It works offline or on any static host. Individual pieces have stable `#track=` links. Locked pieces unlock locally in the singer's browser. GitHub Pages is public hosting; only share material you are entitled to distribute.

A browser can remember settings without an account. My practice data stays on the same browser and site origin, and is lost if its storage is cleared. Optional cross-device accounts are a future integration, not part of this beta. See [the research notes](docs/RESEARCH.md).

## Playback scope

MusicXML playback supports chords, split voices/staves, pickups, ties, tempo changes, transposing instruments, simple repeats and numbered endings. Complex nested repeats and D.C./D.S./coda need an unfolded score. Fermatas use written duration; ornaments, grace notes, percussion, dynamics and articulations are not fully interpreted. Transposition changes audio, not printed notation.

MIDI preserves note timing, velocity and tempo. Its score is reconstructed in 4/4 and quantized to sixteenth notes; it cannot recover original spelling, lyrics or phrasing. Sustain and pitch-bend controllers are not reproduced. Type 0/1 MIDI with beat-based timing is supported; use separate tracks for separately controllable parts. WAV export is limited to ten minutes or a shorter loop.

Semibreva's generated MusicXML can already be imported. Confidence sidecars and direct scanning are future integration work.

## Development and distribution

Use Node 22 or later:

```sh
npm ci
npx playwright install chromium
npm test
npm run prepare:helpers
npm start
```

`npm test` builds the app and runs crypto and browser regression tests. `npm run test:desktop` checks Electron isolation, mocked publishing and cursor timing. Packaging commands are `npm run dist:mac` (separate Apple Silicon and Intel macOS packages) and `npm run dist:win` (per-user x64 NSIS). Use `npm run dist:mac:arm64` or `npm run dist:mac:x64` for one Mac architecture. Full instructions are in [docs/RELEASE.md](docs/RELEASE.md).

These development installers are not publisher-signed or Apple-notarized. macOS/Windows may require security approval. A warning-free public installation needs appropriate publisher signing and verification. Native Windows installation and real GitHub publishing remain release checks; browser tests do not substitute for them.

## Licence and credits

AGPL-3.0-only, following Recitavo's open-source direction; optional commercial services remain possible. See [LICENSING.md](LICENSING.md). Every built app and practice page has an **App source & licence** download in its guide. That archive contains software source and build instructions, not imported scores or personal data.

OpenSheetMusicDisplay, fflate, @tonejs/midi, Electron, GitHub CLI and the Salamander Grand Piano samples retain their own licences. See THIRD-PARTY-NOTICES.txt. The project is not affiliated with Coria or GitHub.

On phones, the score uses a compact fit scale. Use **Show** above the score to choose one voice or instrument, **Fit** to restore the automatic scale, and **Bars** for navigation and loops. Choosing a score part does not mute the other parts. The choice is remembered on this device. On phones, scores with more than eight parts initially show the first part; Full score is always available.

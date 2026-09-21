# Beta work list

This is the structured record of the requested revision. Unchecked items are not implemented or verified merely because they are listed here.

## 1. Score reliability and rehearsal

- [ ] Reproduce and fix the reported MusicXML import failure with a minimal original regression fixture.
- [x] Remove excess top whitespace without removing musical content.
- [x] Follow toggle that yields to manual scrolling during playback.
- [x] Click a measure to seek; select a measure range to loop.
- [x] Focus buttons centred; clicking focused part again restores the previous mix.
- [x] Multiple instrument sounds and choir timbres, with accurate labels and distributable asset licences.

## 2. Creator interface

- [x] Full Recitavo-informed redesign, following UI Craft; fixed desktop workspace and score viewport.
- [x] Import review dialog; accessible Piece settings.
- [x] Replace “project” with “library” in visible wording while retaining storage compatibility.
- [x] Click part names to rename; choose Voice or Instrument per part.
- [x] Remove redundant subtext and author-assigned learning statuses.
- [x] Validate desktop/mobile, keyboard focus, sliders and long names visually.
- [x] Add portrait and landscape phone layouts, vertical/sideways score flow, and five-second automatic follow recovery.

## 3. Organisation and publishing

- [x] Folders in each library; coloured tags and frequently used tags.
- [x] Reframe libraries as independent rehearsal rooms; remove the sidebar and colour every folder tab independently.
- [x] Add Dutch room/site language and list sorting by custom order, title, composer, date or folder.
- [x] Drag ordering, including keyboard-accessible move actions.
- [x] Bulk selection to move, hide, lock or delete pieces.
- [x] Hidden pieces excluded from every publishing/export path.
- [x] Password-locked pieces encrypted in exported HTML; no plain score/MIDI/note payload left in the file.
- [x] Migration and backup/restore preserve old libraries and private music.

## 4. Accounts, naming and integrations

- [x] Document local browser progress without sign-in; assess optional cross-device sync separately.
- [x] Research free alternatives using current primary sources.
- [x] Shortlist Latin-inspired names, check collisions and .com registration/renewal pricing. Keep Choirloom as a working name until chosen.
- [x] Explore importing Semibreva MusicXML + confidence sidecar; avoid treating OMR as verified notation.
- [x] Preserve account-free practice and offline authoring; paid server features optional.

## 5. Repository and beta delivery

- [x] Use Recitavo as the primary design and distribution reference.
- [x] Add portable browser tests, CI and draft beta release workflow.
- [x] Add source-only ignore rules, contributor guidance, issue template and release checklist.
- [x] AGPL source distribution confirmed by the owner, with optional commercial services kept possible.
- [ ] Complete and verify the above blocking product changes before public beta.
- [ ] Run CI in the real repository and test installers on actual macOS and Windows.
- [ ] Configure publisher signing/notarization for a seamless public installation.

Updated 2026-09-21. Local browser and macOS Electron checks pass. Public beta readiness still requires the native installation and publishing checks below.

Local diagnostic: both reported scores imported and rendered with the current parser and OSMD. The earlier import error was not reproduced. Both files pass import review, render with compact top spacing, seek by measure, and allow manual scrolling during playback in the revised app. No private scores are included in source.

## Remaining release decisions

- Choose the final name from the researched options; retain current storage identifiers when renaming.
- Provide the eventual source repository URL and run its CI. No remote exists locally yet.
- Verify real browser login/publish/update against a disposable GitHub repository and fresh native installs on macOS/Windows. Current publishing tests are mocked.
- Configure publisher certificates and macOS notarization for a public release without development-signature warnings.

The score import failure stays open as an unreproduced report, not a claimed parser fix. Direct Semibreva scanning, sidecar review and cross-device accounts are assessed future integrations, not implemented features.

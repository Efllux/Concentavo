# Release process

The source repository is [Efllux/Concentavo](https://github.com/Efllux/Concentavo). Each rehearsal room can publish to its own separate GitHub Pages repository. No choir scores, site exports, backups or credentials belong in the Concentavo source repository.

## Candidate checks

Use Node 22 or later. GitHub Checks runs the browser, audio, encryption and desktop smoke tests on macOS, Windows and Linux where applicable. Locally:

```sh
npm ci
npx playwright install chromium
npm test
npm run test:desktop
npm run release:check
```

The tag must match `package.json` and `package-lock.json`. Push an annotated `v*` tag only after main's checks pass. The **Release installers** workflow tests and packages separate Apple Silicon and Intel Mac packages and a Windows x64 installer, then creates a draft release with source and SHA-256 checksums. Tags containing a hyphen create prereleases; plain version tags create stable releases. The updater needs the Mac ZIP files and `latest*.yml` metadata, so keep them attached when publishing.

Development builds are not publisher-signed or notarized. macOS and Windows may warn on first launch. Do not describe these builds as warning-free one-click installs. Signing and notarization remain a separate release task requiring publisher credentials.

## Verify the draft before publication

- [ ] Download each installer from the draft and compare its SHA-256 digest with `SHA256SUMS.txt`.
- [ ] Fresh-install and launch on Apple Silicon and Intel Macs without development tools present.
- [ ] Fresh-install, launch, update and uninstall on Windows x64.
- [ ] Confirm an existing local rehearsal room survives an app update.
- [ ] Import both reported regression scores; check playback, sustain, score scroll, seek and loop.
- [ ] Verify offline authoring and account-free practice website playback.
- [ ] Sign in to GitHub in the installed app and publish, then update, a disposable rehearsal-room website.
- [ ] Verify hidden pieces and locked score contents are absent from the exported website's plaintext source.
- [ ] Record the signing and operating-system warning behavior accurately in the release notes.

The automated publishing test mocks GitHub. A green CI run or successful installer build does not replace native installation, updater and GitHub publishing checks. Publish the draft only when those checks are complete. Release candidates use prerelease update channels; stable builds follow stable releases.

For local packaging, run `npm run prepare:helpers`, `npm run build`, then `npm run dist:mac` on macOS or `npm run dist:win` on Windows. Helpers are pinned downloads verified against upstream checksums. End users do not install Node or the GitHub CLI. `build.electronLanguages` in `package.json` lists bundled Chromium languages and should grow when more app translations are added.

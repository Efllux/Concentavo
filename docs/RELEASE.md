# Preparing the first beta

Concentavo is prepared for a public GitHub source repository. The app's publisher creates separate *practice website* repositories for rehearsal rooms; the app's own source repository is separate.

## Create the source repository

In GitHub Desktop choose **Add an Existing Repository**, select this source folder, then **Publish repository** when ready. Keep it private while completing the beta checklist. Do not include downloaded scores, exported choir websites, backups, signing keys, vendor binaries or node_modules.

This folder is already initialized as a local Git repository on `main`, with no remote or initial commit. Review `git status`, stage and commit the source when ready. Add the remote after creating an empty GitHub repository. No remote is configured by these instructions.

## Checks

Use Node 22 or later:

```sh
npm ci
npx playwright install chromium
npm test
npm run release:check
```

Tests use Playwright Chromium on macOS, Windows and Linux. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an installed browser. macOS Chrome is a local fallback. Test screenshots/exports stay in ignored `test-results/`.

GitHub Checks runs these tests on all three systems. Require it in branch protection after the first successful run. A green UI test is not a native installer test.

## Build without publishing

Run **Actions → Beta installers → Run workflow**. Both platforms test before packaging. Download the resulting artifacts from the workflow run. This action does not create or publish a release.

For local packaging, run `npm run prepare:helpers`, `npm run build`, then `npm run dist:mac` on macOS or `npm run dist:win` on Windows. Helpers are pinned GitHub CLI downloads, verified against upstream release checksums. Runtime dependencies are bundled. End users do not install Node or the CLI.

macOS releases use separate Apple Silicon (`arm64`) and Intel (`x64`) packages instead of one universal package. This avoids shipping two copies of Electron machine code to every Mac. The release ZIP files are required by the updater; users normally download the PKG matching their Mac.

`build.electronLanguages` in `package.json` lists the Chromium locale resources shipped in the desktop app. Keep it aligned with the languages offered by `src/i18n.js` whenever a translation is added. App translations remain ordinary source data and are not limited to Dutch and English.

## Draft release

1. Complete the blockers in BETA-PLAN.md and update CHANGELOG.md and BETA-NOTES.md.
2. Match package.json and package-lock.json versions. The initial prepared version is `1.1.0-beta.1`; it is not a published release.
3. Commit and push an annotated matching `v1.1.0-beta.1` tag.
4. The workflow tests and builds both platforms, archives matching source, computes checksums, and creates a **draft prerelease**. It refuses to modify an already published release.
5. Verify the exact downloaded installers before publishing the draft manually.

No personal access token is needed by this workflow. Only the draft job receives `contents: write`; other jobs use read access. See [GitHub workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions).

## Native verification before release

- [ ] Fresh installation and launch on Apple Silicon and Intel macOS; no development dependencies present.
- [ ] Fresh per-user install, launch, update and uninstall on Windows x64.
- [ ] Existing local library and settings survive app update.
- [ ] Import both regression scores privately; playback, scroll, seek and loop behave correctly.
- [ ] Offline app works; exported practice site works without an account.
- [ ] GitHub browser sign-in, first publish and update tested on a disposable repository.
- [ ] Hidden/encrypted content verified in source of all exported files when those features land.
- [ ] Signing, notarization and fresh-download OS warnings recorded accurately.
- [ ] Source, dependency notices, licence and SHA256SUMS accompany the installers.

Current packaging produces development builds with local macOS integrity signing, not Developer ID/notarization or a trusted Windows publisher signature. Configure and verify signing before advertising installation without security prompts. The current workflow does not claim to perform publisher signing.

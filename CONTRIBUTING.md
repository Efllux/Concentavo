# Contributing

The app is preparing for its first public beta. Read docs/BETA-PLAN.md and docs/DESIGN.md before substantial interface work. Recitavo is the primary product reference.

## Development

Use Node 22+, `npm ci`, `npx playwright install chromium`, then `npm test`. `npm start` opens the Electron app after a build. Build instructions and native release requirements are in docs/RELEASE.md.

- Keep desktop authoring and account-free exported practice pages usable offline.
- Preserve existing local storage and old backup compatibility.
- Test changes with small original fixtures. Never commit private scores, GitHub credentials or personal backups.
- Include before/after screenshots for interface changes and meaningful regression tests for bugs.
- Keep dependencies and their notices documented, including any sound assets.
- Review LICENSING.md before submitting contributions.

Describe the concrete problem, resulting behaviour and verification in pull requests. Do not claim Windows/macOS installer verification from browser tests alone.

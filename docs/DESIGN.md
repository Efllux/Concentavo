# Design direction

Primary reference: Recitavo. Unfolia and Semibreva are early integration references, not UI templates.

## Product

The desktop user is a choir leader preparing scores for other people. The published website is for singers practising, without accounts. The score wins the first three seconds of attention. Authoring and singing share playback controls; publishing, bulk management and part editing belong to authoring.

## Recitavo patterns to adopt

- A compact, stable header and a workspace constrained to the window height.
- The document gets the available space; its viewport scrolls independently of fixed transport controls.
- Secondary settings open in focused dialogs, rather than adding more panels below the score.
- Warm paper, dark ink, restrained violet accents and system fonts. Serif type belongs to document content, not oversized dashboard headings.
- Local operation, self-contained exports, and explicit optional network features.
- Platform builds and draft releases with documented verification requirements.

Use these principles, not a literal copy of Recitavo's Svelte/Tauri implementation. Keep the existing Electron app identity and storage database during redesign so existing music survives upgrades.

## Proposed workspaces

Rehearsal room: one spacious page without a sidebar. The header switches rooms; coloured folder tabs sit above search and sorting. Pieces are bordered, selectable units with their selection boxes on the right. Import and Publish are the main actions. Every room exports or publishes as its own independent website.

Piece: title and Piece settings at the top, score in the main pane, editable parts in a narrow right pane, transport along the bottom. Desktop has no outer page scroll. On small screens, Parts and Score are selectable views; transport stays reachable. Portrait uses a compact vertical score. Landscape can use one continuous sideways strip and hides the mixer until requested.

Import: review detected title, composer, folder, tags and part names before saving. Errors identify the offending file, retain valid selections, and let users retry.

## Interaction requirements

Focus toggles off and restores the previous mix. Names are directly editable in authoring. Follow score is explicit, pauses on manual scrolling, and resumes deliberately. Clicking a measure seeks; a separate loop-selection mode selects first and last measures. All mouse actions have keyboard equivalents and visible focus states.

Remove slogans, dashboard counts that do not help a decision, readiness statuses assigned by the author, and redundant explanatory subtext. Personal learning progress is optional, stored locally and clearly distinct from published tags.

## Verification

Check short and long scores, many parts, long titles, empty folders, failed imports, narrow windows, mobile, keyboard navigation, reduced motion, and playing while manually scrolling. The two reported user scores are private local QA inputs and must not enter the repository.

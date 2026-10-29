# MusicXML compatibility

Concentavo retains the original source and a compact score for notation. A separate playback route follows repetitions and jumps; it does not insert duplicate measures into the displayed score or exported practice website.

| Input or notation | Handling |
| --- | --- |
| Partwise and timewise scores | Timewise grouping is converted in memory to partwise for notation. Written measure numbers remain unchanged. |
| Default/prefixed XML namespaces | Elements are normalized for the notation renderer; namespaced attributes remain intact. |
| Plain XML/MusicXML and compressed MXL | Container root paths support relative prefixes, backslashes and percent-encoded filenames. UTF-8, UTF-16 and supported declared legacy encodings are decoded before parsing. |
| Changing divisions, pickups, backup/forward, chords | Timing follows MusicXML durations, preserving silent measures and selected-part alignment. |
| Ties | Sound ties and notation ties, including continue, are joined for playback. |
| Additive/composite meters and staff transposition | Each beat group uses its own denominator; numbered transposition applies to its staff. |
| D.C., D.S., coda, Fine and repeats | Sound markers take precedence. Nested repeat sections and numbered endings use their section pass. Repeats in a returned section normally do not repeat again unless after-jump requests it; new coda repeats still play. |
| Navigation without sound markers | Common English/Italian D.C./D.S./To Coda/Fine text, explicit written bar references, segno/coda elements and SMuFL/Unicode symbols are recognized. Unique destinations are required; ambiguous or missing targets are warned about and skipped. |
| Shared choir staves | Pitch continuity, stems, ties and written voices guide separation. An explicit resting voice prevents a solo entry from being copied as a shared unison. Automatic detection can be overridden per staff. |
| Harmony | Rooted major/minor/diminished/augmented, seventh, sixth, extended, suspended and power kinds support generated accompaniment, slash bass and degree modifications. N.C./kind none stops it. Unsupported/rootless functional harmonies remain in notation and produce a warning instead of an import failure. |

Use **Piece settings → Re-read original score** to apply the current importer to an existing piece. It preserves stored part names, sounds, visibility/removal, shared passages and practice settings when part identities still match. An already unfolded source remains unfolded: import the compact source to regain compact notation.

Written-only navigation is an interpretation of exporter notation, so its import warning asks for route review. Several labeled destinations, complex instructions outside the recognized forms, and unusual repeat encodings may require clearer MusicXML markers. Measure-repeat symbols need explicit notes for playback. Grace notes, ornaments and unpitched percussion are not played; fermatas keep their written duration. Dynamics and articulations are not fully interpreted. Audio transposition does not rewrite printed pitches.

The regressions cover structure and encoding normalization, harmony edge cases, choir rests, navigation offsets, nested repeats, alternate endings, notes sustained across jumps, selected-part notation, and saved-piece re-reading. Real score comparison also checks compact original and MuseScore exports without committing private scores to the repository.

# Product research — 21 September 2026

## Naming

Five coined names fit alongside Recitavo, Unfolia and Semibreva. **Concentavo** is the strongest current recommendation: Latin *concentus* means sounds blending in harmony and can refer specifically to a choir, while the ending gives it the same family cadence as Recitavo.

| Name | Direction | .com check |
| --- | --- | --- |
| Cantivaro | Singing; distinct from Recitavo | Verisign RDAP returned 404; Porkbun offered registration at US$11.08/year and renewal at US$11.08 |
| Vocitavo | Voice; strongest family resemblance to Recitavo | Same registry and registrar results |
| Partivela | Musical parts; a softer name | Same registry and registrar results |
| Concentavo | Singing together and harmony; strongest meaning and product fit | Verisign RDAP returned 404 on 21 September 2026 |
| Cantivela | Song-led and softer sounding; close to the family without copying Recitavo | Verisign RDAP returned 404 on 21 September 2026 |

The names are coined rather than literal Latin words. Exact-name searches did not find a clear competing software product for Concentavo, Cantivaro or Vocitavo; Cantivela and Partivela occur as personal names. Vocavela was rejected because an active language-learning service already uses it, and Moduliva was rejected because the name and domain are already in use. This is a preliminary collision check, not trademark clearance. Prices and availability can change before registration. No domain has been purchased or added to a cart.

Sources: [Porkbun .com pricing and search](https://porkbun.com/tld/com), [Latin *concentus*](https://atlas.perseus.tufts.edu/dictionaries/entry/urn%3Acite2%3Ascaife-viewer%3Adictionary-entries.atlas_v1%3Alat.ls.perseus-eng2-n9774/), [Cantivaro registry endpoint](https://rdap.verisign.com/com/v1/domain/cantivaro.com), [Vocitavo registry endpoint](https://rdap.verisign.com/com/v1/domain/vocitavo.com), [Partivela registry endpoint](https://rdap.verisign.com/com/v1/domain/partivela.com), [Concentavo registry endpoint](https://rdap.verisign.com/com/v1/domain/concentavo.com), [Cantivela registry endpoint](https://rdap.verisign.com/com/v1/domain/cantivela.com). Registry requests used the public Verisign API; registrar quotes were read from its live search interface.

The app retains Choirloom as its working name pending the owner's choice. A rename must retain the existing app data path, database, website ownership marker and old backup compatibility.

## The other Choirloom projects

GitHub's public repository search returned [Zhanyuanium/Choirloom](https://github.com/Zhanyuanium/Choirloom) (created 12 August 2026) and [blhsing/Choirloom](https://github.com/blhsing/Choirloom) (created 8 September 2026). The latter describes a voice ensemble score editor and singing synthesis studio. This confirms the name collision; it does not establish code provenance or identify which interface the user saw. No code from these projects was imported for this redesign. The design reference is the user's local Recitavo project.

## Free alternatives

| Tool | Useful free capability | Difference from this app's intended workflow |
| --- | --- | --- |
| [Coria](https://coria.nl/en/play_own_file) | Own MusicXML/MXL and Noteworthy files, part rehearsal, downloadable practice HTML | Already covers the central standalone HTML use case. Its documented import flow does not list MIDI. This app adds desktop library/folder management and direct GitHub publishing. |
| [capella reader](https://www.capella-software.com/us/index.cfm/products/capella-reader/info-capella-reader/) | Free Windows/Mac reader for capella, MusicXML and MIDI; part playback and printing | A strong free desktop rehearsal alternative. Its product page describes distributing score files, not exporting a managed standalone practice website. |
| [MuseScore Studio](https://musescore.org/en) | Free open-source notation editor and playback; MusicXML/MIDI import/export | Strong for preparing or correcting scores. It is a notation editor, with more complexity for occasional singers; the paid musescore.com service is separate from the free desktop editor. |
| [OpenVox](https://github.com/vadymyem/OpenVox) | Repository describes free, open-source choir practice, MusicXML/MIDI import and part mixing | A broader vocal toolbox worth investigating. Features are reported from its project documentation; reliability, installation and export workflow have not been independently tested here. |

Not counted as unlimited free equivalents: [Choir Player](https://www.choirplayer.com/) advertises samples plus a paid catalogue subscription; [Nokkeusi Choral Practice](https://www.nokkeusi.com/choral_practice/) is iPhone-only, does not support MIDI and offers a subscription score shop. Its page does not establish an unlimited free creator workflow.

## Account-free progress and optional accounts

The current practice page stores mix, speed, transposition, progress and private notes in localStorage. A GitHub Pages site can do this without any account or server. Data is specific to the browser and site origin; clearing browser data or switching devices does not preserve it. Republishing with stable piece IDs preserves matching preferences on the same origin.

GitHub Pages serves static files; it is not a database or an application backend. GitHub sign-in for optional cross-device sync is feasible, but sign-in alone does not store progress. It needs a defined persistence service (or a carefully designed private GitHub-data integration), authentication, access controls, deletion/export and privacy behaviour. Never put an OAuth client secret or shared administrative token into exported HTML.

For this beta, retain local progress without accounts. A later optional sync service could support GitHub login, with other sign-in choices for nontechnical singers. Core offline practice remains free. References: [GitHub OAuth app best practices](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app), [GitHub OAuth authorization flows](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps).

## Semibreva integration

The local Semibreva project already emits MusicXML, which this app imports. Its confidence sidecar adds the useful next step: identify measures that need a leader's review before publication. The sidecar includes schema_version, backend, part/measure identifiers and issue codes; it can also contain private source paths, which should not be published.

Recommended sequence:

1. Continue using Semibreva → MusicXML → this app today.
2. Add optional sidecar import and review markers keyed by part ID and printed measure number. Preserve duplicate measure labels and uncertain OMR output rather than silently accepting them.
3. Once Semibreva is stable, add a local scan action through its CLI or loopback service, with health checks, cancellation and explicit user-selected input files. Do not bundle the unfinished OMR stack merely to expose a button.

Recitavo remains the primary reference for interface design, local operation and distribution. Unfolia is relevant to document preparation, not this app's current rehearsal interface.

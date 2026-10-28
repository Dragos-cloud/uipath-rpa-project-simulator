# Changelog

All notable public-facing changes are documented here.

## v0.70 publication — 2026-10-28

- Publish the v0.64–v0.70 development milestones below together: exception raises/Catch evidence and Explain, flexible PDD extraction and its canonical contract, import diagnostics, supported legacy XAML compatibility, document-role review, filtered configuration context and step-specific configuration evidence.
- Update the public README, EN/RO in-app guide, handbook and maintainer references for v0.70. Keep schema 1 compatibility and the documented limits on runtime execution, unsupported routes and AI interpretation.
- Add the approved 25-second horizontal promotional short as a v0.70 release attachment, with a README poster/link, video details and music attribution. The revised opening is “Four perspectives. One shared process.” The full recorded app view, chosen ElevenLabs narration, visual author credit and persistent AI disclosure are preserved.
- The short reuses recorded synthetic-project footage from v0.63. It does not claim to demonstrate the new configuration inspector. Keep the previous 3:28 walkthrough and earlier releases unchanged. Raw captures, voice files, private imports, code evaluation and credentials remain excluded.
- All 152 regression tests pass and embedded JavaScript compiles before publication. The delivered MP4 is 25 seconds, 1920×1080 at 30 fps with AAC audio. Older PDF drafts remain local; the current bilingual guide is in the app.

**Historical milestone notes:** the “local, not published” headings and no-push statements below record each development turn's status at that time. Their changes are included in this v0.70 publication; they are not still pending separate publication.

## 0.70 — 2026-10-27 — local, not published

### Step details: configuration on the relevant card

- Implement the approved Step details preview only. Click a process card for **Configuration used by this step / Configurația folosită de acest pas**: categories, filtered values or status, linked document names and source cells. **Show where this comes from** expands setting keys, imported-relative paths and code/argument references. Full source details stay expandable so the main card remains business-friendly.
- Bind evidence using explicit workflow/activity/caller identifiers, not prose matching. Workflow cards cover their own workflow, including handling code; inline cards cover an activity subtree, and decision cards cover only the decision activity. Do not assign child settings to unrelated/sibling cards or automatically include all descendants. Exact/suffix/unique-name identity is required; ambiguous workflow references are not guessed.
- Tie supported one-hop template/file arguments to the specific caller activity, so repeated calls to the same workflow keep their own keys. Dynamic expressions, multi-hop propagation, aliases, assignments/overrides and effective runtime values remain outside the analysis. Config is context, never approved requirements or proof of execution.
- Preserve hidden values, formula/asset status and separate duplicate candidates. Unknown keys say only that they were not found in the supplied config. Empty results do not establish an absence of configurable behaviour. Bound per-card inventories to 40 keys, eight code references per key and eight candidate rows, with explicit omission notices.
- Save optional version-1 `configSource` / `configEvidence` on imported steps without changing Process Model schema 1. Old or unsupported/malformed evidence gets re-import guidance; samples and assumed exception steps do not acquire invented settings. Inspector placement now stays within the viewport at narrow widths instead of extending outside the diagram pane.
- Update both in-app guides, README, handbook, project-context documentation and CI. Explain, existing general Brief/Ask context, generated PDD drafts, step labels, timings, scenarios, requirements mappings and gap logic are unchanged. The PDF manual/video are not regenerated.

### Verification

- All 152 tests pass, including 14 new synthetic inspector/binding tests: scope isolation, repeated calls, ambiguous workflows, duplicate values, source cells, privacy canaries, formulas/assets, empty/unresolved states, inventory limits, unsupported saved evidence, escaping, model nonmutation, schema-1 serialization and EN/RO labels.
- Real-browser legacy-project import still reads all 24 XAML workflows. The template-using card shows its document and config-cell evidence with the exact caller/child file operation; an unrelated card does not receive that template. Source expansion and EN/RO switching were checked. Browser Save session, reload and Load session retain the new Step details without re-reading source files. No warning/error logs were observed during the saved-session check.
- Checked an open inspector across desktop and narrow viewport breakpoints; the panel remains within the visible browser area. This does not claim a redesign of the entire simulator for phone-sized windows.
- Imported source files were not modified. No AI inference, commit, push or release was made; all changes remain local on top of published v0.63.

## 0.69 — 2026-10-23 — local, not published

### Document roles and configuration context

- Stop treating every Word file as PDD requirements. Add an EN/RO document-role review before mapping: likely PDD, operational document/bot template, or needs review. Suggestions use supported extracted content plus supplied code/config references; filenames alone do not decide. Conflicting/ambiguous evidence stays reviewable. Users can override a readable document’s role and explicitly select one PDD or none. Failed document readers remain visible and cannot be selected as PDDs.
- Keep converter priority as the initial choice among likely PDDs (JSON first, stable input order for ties), not a forced winner. Only the selected PDD enters mapping, requirements gaps and coverage; no cross-document merge is claimed. No-PDD messaging now says no document is selected rather than implying that every supplied DOCX is documentation.
- Accept named Config/Settings `.xlsx` files, including variants such as `Config-dev.xlsx`. Read supported Name/Value tables from Settings, Constants and Assets using existing browser ZIP/XML primitives. Track source cells, supported literal Config lookups, direct imported-document references and one-hop config-to-child file operations. Unknown code keys are “not found in supplied config,” not runtime defects.
- Omit sensitive config rows entirely. Hide other values by default; allow only bounded retry integers, test-mode boolean/0/1 values and credential-free HTTP(S) origins. Preserve links to imported documents, not original full paths. Do not retain config descriptions, formula expressions or cached formula values. Do not execute macros/formulas or follow external relationships; reject XML entity/DTD declarations and bound archive/row/cell sizes. This is not a general secret scrubber for workflow/PDD prose or user-edited sessions.
- Add sanitized Project documents and configuration to Gaps, session snapshots and gap Markdown exports. General AI project context receives a bounded, separate configuration/document-role section, explicitly not requirements or verified runtime state. Optional `_projectContext` uses version 1; Process Model and canonical PDD schemas remain 1. Old sessions continue without this evidence; re-import original files to obtain it.
- Update both in-app guide languages, README, handbook, PDD-contract documentation and add `docs/PROJECT_CONTEXT.md`. The PDF manual and promotional video are unchanged. Add CI coverage for document roles/config boundaries.

### Verification

- 138 dependency-free tests pass; embedded JavaScript compiles. New synthetic tests cover classification/overrides, source selection, duplicate/ambiguous matches, secret canaries, config allowlists, formula/assets handling, shared/inline OOXML strings, external relationships/entities, one-hop argument evidence, ZIP/decompression bounds, escaping and EN/RO parity. Existing PDD, legacy XAML, exception evidence, scenarios, branding and guide tests remain green.
- Browser import of the older job-posting project keeps all 24 workflows readable. Its main Word template is suggested as operational via config-cell and child CopyFile evidence; the test-folder copy stays needs-review. No PDD is selected by default. The saved snapshot contains 31 filtered config entries and omits two sensitive rows, with no raw config-value fields. Save, reload and Load session preserve roles/config evidence; EN/RO context rendering and manual role/source overrides work. No browser warning/error logs were observed during these checks.
- Browser regression imports retain the synthetic order project’s 3 PDD sections / 32 elements / 9 exceptions / 6 scenarios and ANAF’s 5 sections / 19 steps / 4 exceptions. ANAF still explicitly reports its unsupported selectable Flowchart routes and 13 missing workflow references; this update does not invent route support or complete missing code.
- Imported projects/workbooks/PDDs were read only, not edited or added to repository fixtures. No AI endpoint request was made for these checks. All v0.64–v0.69 changes remain local on top of published v0.63; no push or release was made.

## 0.68 — 2026-10-23 — local, not published

### Legacy XAML investigation and compatibility

- Reproduced a legacy Studio 19.10 project import: 9 of 24 supplied XAML files failed in the browser. The files were accepted by the .NET XML reader. Detailed browser diagnostics identified assembly-qualified CLR namespace declarations containing spaces, rejected as invalid namespace URIs; these were not missing workflows or malformed activity bodies.
- Add a narrow, in-memory compatibility pass over actual XML namespace attributes. Percent-encode whitespace only in the assembly identity of `clr-namespace:…;assembly=…` values; retain namespace prefixes, CLR namespace names and assembly version/culture/token metadata. Original project files, selectors, expressions, messages and code are not edited.
- Skip comments, CDATA, processing instructions and declarations/DTD subsets; consume whole quoted attributes to avoid rewriting namespace-looking content inside other values. Handle numeric whitespace references without double-encoding existing escapes. Do not add DTD/entity resolution or broadly repair broken XML.
- Persist original/adapted namespace evidence and add EN/RO **Older XAML format accepted / Format XAML vechi acceptat** in Import review. Optional report data remains compatible with older sessions and Markdown exports. Remaining XML failures now report a bounded browser diagnostic, with line/column when supplied, instead of only “Malformed XML”.
- Update README, handbook and both guide languages. Add synthetic legacy-XAML regression tests to CI; no private source workflow was added as a fixture.

### Verification and remaining limits

- All **121 automated tests** pass, including modern-input preservation, default/prefixed and single/double-quoted namespaces, whitespace entities, idempotence, protected text/declarations, malformed-input failures, Catch type resolution, bounded diagnostics, evidence serialization and escaped/optional report rendering.
- Fresh browser folder import now reads **24/24 XAML files with zero parse errors**, versus 15/24 before the fix. **9 workflows / 122 namespace declarations** use the compatibility adaptation. The resulting model has 35 steps and no missing referenced workflows; import review records source compatibility separately from runtime/route support.
- Browser Save session, app reload and Load session retain all 24 parsed workflows, zero parse errors, original/adapted namespace evidence and unchanged Process Model schema 1. Import review and compatibility wording were verified in English/Romanian, with no browser warnings/errors during the final checks. No new runtime execution, Flowchart scenarios or universal legacy-format support is claimed.
- The folder also supplies two Word files under Data named as templates, with no recognized PDD process-step sections. That separate import warning is not an XAML parsing failure. Source selection/classification behavior is unchanged in this revision.
- Original project/PDD files were not edited or committed. The PDF manual and video remain unchanged. All v0.64–v0.68 work remains local on top of published v0.63; no push or release was made.

## 0.67 — 2026-10-23 — local, not published

### Canonical PDD foundation

- Formalize the existing normalized documentation as Canonical PDD Model (CPM) version 1. JSON and DOCX readers now return one validated contract, with common collections, deterministic per-document record UIDs, derived mapping views and explicit diagnostics. PDD schema, reader/converter version, source document revision and Process Model session schema are independent.
- Add a dependency-free runtime validator and enforce it at converter and model-builder boundaries. Reject malformed collections/records, unsupported versions, duplicate identifiers, invalid evidence and broken exception-state links rather than silently replacing them with empty requirements. Already-versioned CPMs validate before any defaults/rebinding; unversioned programmatic fragments are normalized without mutating callers or fabricating source locations.
- Introduce an extension-based JSON/DOCX converter registry with injected reader/registry seams for tests. Preserve default JSON precedence and first-document selection for equal priorities; disclose the selected source and retain parse failures. An invalid higher-priority candidate cannot replace a valid PDD. There is no DI framework, new dependency, build step or server requirement.
- Retain original JSON Pointer locations and Word table/row/block references, including metadata, additional exception occurrences, application evidence and operational details. Application names remain compatible with existing consumers. Coverage distinguishes classified/unrecognized tables and does not certify complete extraction.
- Standardize optional document revision/date/author, template identifier and expected scope. EN/RO Document details and sources distinguishes provided, detected and unknown values, with available source locations. Missing metadata does not block import; inferred titles are labelled detected. Declared template IDs are retained, not used as automatic template-profile selection rules.
- Update both in-app guide languages, import guidance, README and handbook; add `docs/PDD_MODEL.md` as the maintainer contract and extension reference. New contract tests run in CI alongside the existing parser/import/scenario tests.

### Verification and boundaries

- All **106 automated tests** pass, including normalization parity/nonmutation/idempotence, optional EN/RO metadata, source binding, malformed inputs, future/corrupt versions, identifiers, injected converters/priorities, source failure propagation, saved-session serialization and documentation-versus-execution boundaries.
- Fresh browser import of the reported Romanian project retains **5 TO-BE sections / 19 steps / 4 documented exceptions**. All 26 tables remain accounted for, with 9 unnormalized. Document revision 1.1 retains its source row. Flowchart routes remain explicitly unsupported, not fabricated by the PDD contract.
- Fresh Customer Order Processing import retains **3 sections / 32 elements / 9 exceptions / 6 state transitions / 5 human-task requirements / 14 rules**, with all **6 selectable scenarios** preserved. Save session, reload the latest app, and Load session preserves those scenarios and the CPM/source evidence; exported Process Model schema remains 1 and PDD validation reports no issues. EN/RO metadata layout and source wrapping were checked in the browser; no browser warnings/errors were observed during these checks.
- Standalone single-HTML packaging and dependency-free operation are unchanged. Browser checks used the local HTTP preview. Direct `file://` opening could not be tested because the embedded browser blocks that protocol; no security restriction was bypassed.
- No cross-document comparison/merge/source-selection UI, AI extraction, PDF parsing, automatic metadata editing or Flowchart simulation is included. Source project/PDD files were not edited, and private imports were not added to Git. The PDF manual and video remain unchanged and versioned for their earlier revisions.

Publication status: v0.64–v0.67 remain local changes on top of published v0.63. Nothing has been pushed or released in this revision.

## 0.66 — 2026-10-23 — local, not published

### Import investigation

- A real legacy Romanian PDD exposed gaps in the earlier normalization tests. `Nr. / Descriere / Detalii` under General information was mistaken for 14 process steps, while `Nr. pas / Descrierea acțiunii / Detalii` in the actual TO-BE tables was not recognized. The import therefore offered the wrong section for mapping.
- The exception aliases `Nr. pas la care apare` and `Acțiune de întreprins` were missed: four definitions were detected, but their step references and response actions were empty.
- With no project manifest, the importer passed the first selected filename as the project name, allowing a coded-workflow filename to override the documented process identity.
- The missing Scenario selector was a separate issue: the reported import uses Flowchart decisions. The existing scenario builder supports structured If/Else routes, not connected Flowchart graphs, and silently hid its control when no supported route was available. This was not loss of the previously demonstrated If/Else scenarios.

### Fixes and visibility

- Read General information as metadata, retain the documented process name, trigger, document revision and selected operational fields, and keep that table out of process steps. Explicit manifest names still take precedence.
- Support inflected Romanian action/exception/intervention headers, skip merged group banners and repeated header rows, retain actual row references, and continue excluding AS-IS steps. Also recognize the supplied notification, application, test-case and out-of-scope table layouts.
- Keep Scenario visible but disabled with an English/Romanian explanation when no supported routes can be built. Do not invent Flowchart routes or conflate them with Inject exception.
- Add a versioned Import review to Gaps, saved sessions and gap-report Markdown exports: selected PDD, entry/process files, parsed workflow count, route support, table/step counts, source errors/warnings and missing workflow references. PDD diagnostics now include the column headings that were read.
- Prevent JSON without recognized PDD fields from silently taking precedence over a Word PDD; report it as skipped. Preserve valid JSON-PDD precedence and disclose multiple-PDD selection. Persist actual parse errors instead of leaving them only in a transient alert.
- Qualify gap descriptions: weak text matches are not proof of undocumented/unapproved behavior, and imported document order is not a verified runtime trace.

### Verification and remaining limits

- All **85 automated tests** pass, including full model-builder checks, PDD selection/error propagation, structured-branch preservation, disabled Scenario explanations, escaping and the new Romanian-header regressions. CI includes the full import-pipeline tests.
- Fresh browser import of the reported 17-file folder: 14 XAML files parsed, **5 TO-BE sections / 19 steps**, 4 documented exceptions with all 4 actions and references retained, document revision 1.1, no source parse errors. All 26 tables are accounted for; 9 non-step tables remain explicitly unnormalized.
- Fresh Customer Order Processing import: **3 sections / 32 elements**, 9 exceptions, 6 state transitions, 5 human-task requirements, 14 rules and all **6 selectable scenarios** retained. Recover OMS Evidence still exposes the same four branch assumptions.
- The reported folder still has **12 Flowchart decisions** with no supported selectable routes, **13 distinct referenced workflows not supplied**, and a coded-workflow black box. These are disclosed limitations/input gaps, not fixed project code. Full Flowchart graph simulation is not implemented in this revision.
- Re-import source files to apply parsing corrections: loading an older saved model does not reparse its PDD. Original project/PDD files were not edited or added to Git. Private source content is not copied into regression fixtures. The previous PDF manual remains versioned for v0.64.

Publication status: v0.64, v0.65 and v0.66 above are local changes on top of the published v0.63 baseline. No push, release update or video change is included in this revision.

## 0.65 — local, not published

- Add Explain to Exception evidence using the configured local LLM, with explicit language settings, a review warning and Markdown export of the answer.
- Replace developer-first descriptions with business-language failure points, work covered and written responses in English/Romanian. Keep types, activity tags, variable targets and parser limits in expandable Technical details.
- Keep error responses separate from known injectable failures and verified runtime outcomes. Cancel display of stale explanations after project/language changes or closing the view; do not send requests when AI is unconfigured.

## 0.64 — local, not published

- Separate recognized explicit raises, injectable model failures and code-defined Catch handlers; zero injection choices no longer implies absent handling.
- Retain namespace-resolved Catch types, protected Try activities, handler actions and simple literal statuses, Finally and nearest-Catch Rethrow evidence with nesting-aware scope.
- Keep handler/Finally-only invocations out of the ordinary process spine. Do not invent triggers from Catch-only workflows or claim verified CLR matching, caller propagation or recovery.
- Stop injected raises with enclosing Catch candidates at Review required rather than fabricate a response.
- Add bilingual evidence summaries/panel, per-workflow inspector evidence, Markdown export, gap/PDD and AI context integration, preserving saved-session schema 1.
- Refine inline Throw New recognition so constructing an exception alone or mentioning it in supported string/comment forms does not create an injection.
- Update both guide languages, documentation and the local EN-then-RO PDF manual. Add exception-evidence regression tests.

## 0.63 — 2026-10-22

- Renamed the app and current documentation to RPA Project Simulator, separating the product name from descriptive UiPath™ import support.
- Added English/Romanian trademark-owner and non-affiliation notices in the guide, footer, README and current promotional draft; no permission or compatibility certification is claimed.
- Preserved browser settings, saved-session schema and import/export behavior. The footer remains in page flow rather than overlaying the app.
- Published the approved 3:28 walkthrough with neutral branding, a four-role introduction, separate Scenario/Inject Exception explanations, in-app inspectors, highlighted controls, reading holds and narration pauses. New actual local-model responses are explicitly subject to source checking. AI-production and trademark notices remain visible; there is no spoken author credit.
- Kept the v0.61 video/release intact as historical material. The new MP4 and English subtitles are v0.63 release assets, not Git-tracked production intermediates.
- Retained the existing repository name, origin, Pages URLs and local project folder by the author's decision.
- Added four branding regression tests.

## 0.62 — 2026-10-22

- Replaced the single scrolling User Guide with eight topic tabs in English and Romanian, keeping navigation visible while the selected topic scrolls.
- Removed the "8. Coming next" section and added the missing Romanian Process Model reference tab.
- Gave the English/Romanian import-file tables a non-wrapping, minimum-width file-type column so headers and extensions stay readable.
- Added accessible tab/panel relationships, keyboard navigation with arrows and Home/End, and preserved the selected topic when switching language or returning from the simulator.
- Scoped simulation shortcuts to the simulator so reading the guide cannot inadvertently play, step or reset it.
- Added six guide navigation regression tests to the validation workflow.

## 0.61 — 2026-10-21

- Replaced raw-condition scenario names with route-focus titles and expandable branch explanations, available without an LLM.
- Added conservative Boolean interpretation for supported VB/C# negation, conjunction, disjunction and equality expressions, preserving branch polarity and exact source values.
- Retained full decision conditions, source workflow and authored label alongside compact display names. Older truncated conditions prompt a re-import; unsupported expressions remain technical.
- Preserved selected branches when toggling AI labels and included selected branch assumptions and full conditions in timeline exports.
- Added scenario polarity, grouping, source-retention, compatibility and selection regression tests.
- Published an import-led, 2:46 walkthrough with actual local-AI responses, English captions and a persistent AI disclosure; the MP4 and subtitles are release assets linked from the README.
- Updated the handbook and walkthrough guidance to distinguish documented requirements, source evidence, unsupported human waits and AI-generated review suggestions from completed implementation.
- Enabled a public GitHub Pages app from the `main` branch root, with `.nojekyll`, a README launch link and hosted/local-AI setup guidance. Application version remains 0.61; hosting does not change its runtime code.

## 0.60 — 2026-10-21

- Added semantic column matching for legacy English/Romanian PDD tables and lane-oriented BPMN element tables, including reordered columns and current/future-state scope.
- Kept exception definitions, state transitions, human-review requirements, business rules and open constraints distinct, with heading/table/row references and visible parsing diagnostics.
- Added PDD mapping for calls in non-REFramework entry workflows and retained the parsed PDD in saved sessions and bounded local-AI context.
- Reworded missing mappings and missing Throw evidence as review findings, not proof of missing implementation. Unspecified exception types are no longer guessed from table order.
- Added dependency-free parser regression tests to the validation workflow.

## 0.59 — 2026-10-21

- Renamed the application to UiPath RPA Project Simulator.
- Reframed the guides and documentation around importing your own project and the needs of BAs, RPA developers, stakeholders, and trainers.
- Allowed the longer app header to wrap and retained existing saved-session and browser-settings compatibility.

## 0.58 — 2026-10-21

- Prepared the public package with generic documentation and clearer LLM endpoint privacy guidance.
- Fixed the GitHub Actions Node.js setup and excluded local production files and credentials.

## 0.57 — 2026-10-21

- Licensed the project under MIT, naming Dragos Marin as copyright holder.
- Added a page-wide, non-overlapping author footer.

## 0.56 — 2026-10-21

- Initial public repository preparation.
- Added publication documentation, static JavaScript validation, and safeguards against accidentally committing imported process material.
- Removed client-specific references from public source comments and product documentation.

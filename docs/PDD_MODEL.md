# Canonical PDD Model (CPM)

Introduced in the v0.67 development milestone and published in app v0.70. The runtime contract is `PDD_SCHEMA_VERSION = 1`, enforced by `canonicalPdd` and `validateCanonicalPdd` in [index.html](../index.html). No package, backend, build step or remote extraction service is needed.

## Boundaries and versions

`PDD file → registered format converter → validated CPM → mapping confirmation → process-model builder`

The CPM describes **documented requirements**, not execution. XAML evidence remains a separate builder input. BPMN remains a task-name cross-check, not a PDD converter or complete executable graph. Training samples remain authored Process Models.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Canonical PDD contract, currently 1. |
| `parser.id` / `parser.version` | Converter/rule implementation used to read the document. |
| `meta.version` | Revision written in the source document; optional. |

The app version is `APP_VERSION`. Saved Process Models still use `meta.schema = 1`; a PDD's schema version does not replace it.

## Contract

All normalized PDDs contain:

| Field | Type and meaning |
| --- | --- |
| `modelType`, `schemaVersion` | Literal `"pdd"`, integer 1. Future/unknown versions are refused. |
| `kind`, `sourceFile` | `pdd-json` or `pdd-docx`; actual relative filename when imported. Direct reader calls have an empty filename until bound by a converter. |
| `parser` | `{id: string, version: positive integer}`. Import converters identify the reader implementation. |
| `meta` | Text values: `code`, `name`, `version`, `date`, `author`, `desc`, `institution`, `templateId`, `expectedScope`. Missing values become empty strings, not guessed metadata. |
| `metadataEvidence` | One `{status, source}` evidence entry per metadata field. |
| `sections[]` | `{uid, ref, idx, title, typed, source, steps[]}`. Steps have `{uid, ref, desc, detail, elementType, kind, source}`. Kind is `activity`, `gateway`, `event` or `exception-route`. |
| `exceptions[]` | `{uid, id, name, cls, pas, params, action, asis, src, source, references[]}`. Classification is `business`, `system` or `unknown`; references retain additional source occurrences. These are documented definitions, not injectable code raises. |
| `exceptionStates[]` | `{uid, name, record, entry, resolution, failure, exceptionId, source}`. A non-null `exceptionId` must refer to a documented exception. |
| `interventions[]` | `{uid, action, desc, type, role, rights, limits, actions, source}`; optional Boolean `documentedOnly` retains existing human-task semantics. |
| `rules[]`, `constraints[]` | Rules: `{uid, id, text, source}`; constraints: `{uid, name, text, source}`. |
| `outofscope[]` | `{uid, activity, reason, impact, source}`. |
| `notifications[]` | `{uid, name, subject, to, source}`. |
| `testCases[]` | `{uid, id, kind, desc, expect, source}`. |
| `apps[]`, `applicationEvidence[]` | Names remain strings for existing consumers. Parallel `{uid, name, source}` records must correspond in the same order. |
| `ops`, `opsEvidence` | Named operational text fields and parallel `{status, source}` entries. |
| `diagnostics` | `tables[]`, text `warnings[]`, and derived `coverage`. Tables retain number, heading, caption, kind, row count and headers. |
| `mappingSections[]` | Derived mapping view, not additional requirements. Typed gateways/events do not become executable routes. |

All collections exist, even when empty. Additional reader-specific fields are retained for compatibility; they do not imply executable semantics. Existing exception/rule/test IDs are preserved. Missing internal IDs are generated, not presented as original document identifiers.

UIDs identify records **within one PDD**. They are deterministic for an unchanged extraction and survive Save/Load, but are not globally unique, semantic cross-document matches or guarantees of stability after document edits/reordering. Do not use them as fuzzy-merging keys.

## Evidence and locations

Every normalized record has a source reference. Metadata and operational fields have separate evidence entries. For example:

```json
{
  "file": "design.docx",
  "format": "docx",
  "heading": "4. Future State > 4.2 Target Flow",
  "table": 3,
  "row": 2,
  "locationKnown": true
}
```

DOCX table/row numbers are one-based. Detected titles retain their ordered document `block` number. JSON references use original JSON Pointers such as `/tobe_sections/0/steps/0`, not invented paths into normalized data. Additional exception references are bound to the same imported filename.

Evidence statuses:

- `provided`: read from an explicit source field; metadata requires a source locator.
- `detected`: inferred from document structure, such as a title used as the process name.
- `unknown`: absent, or retained from a legacy fragment without reliable provenance. A nonempty retained value can still have unknown provenance.
- `user-confirmed`: reserved for explicitly confirmed values; this revision has no metadata-editing/confirmation UI.

Unavailable locators stay `locationKnown: false`. The normalizer never invents table/row references, JSON Pointers, authors, template identifiers or scope. A source location provides traceability, **not proof of semantic correctness**.

`diagnostics.coverage` counts classified versus unrecognized tables. Classified includes excluded current-state tables; it does not mean all content was normalized or that the document is complete. Unrecognized tables keep diagnostic headers and remain reviewable; no missing steps are inferred from them.

## Readers and converter registry

`parsePddJson`, `parsePddBlocks` and `parsePddDocx` produce validated CPMs. DOCX first reads Word XML/styles into ordered paragraph/table blocks, then invokes the block reader. `createPddConverters` supplies:

| Converter | Extension | Priority |
| --- | --- | --- |
| `legacy-pdd-json`, version 1 | `json` | 20 |
| `pdd-docx-tables`, version 1 | `docx` | 10 |

`convertPdd(file, converters)` dispatches by extension, runs the reader, binds the actual filename, validates and returns `{pdd, priority}`. Unsupported formats fail explicitly. `parseAll(files, converters)` accepts an injected registry; `createPddConverters({json, docx})` accepts injected readers. This is a function-based dependency seam, not a DI framework.

Converters must return the documented structure and should attach locators before normalization. Never conceal errors by substituting empty collections. A new source format needs an explicitly supported source kind, converter, validation updates and fixtures; changing the filename extension alone is not sufficient. Source-specific reading stays outside the simulator.

The JSON reader accepts the existing PDD export fields, not arbitrary JSON or exported sessions. Optional `template_id` and `expected_scope` map to shared metadata. Wrong-shaped arrays/rows/text produce path-specific errors. Word metadata supports EN/RO aliases. Declared template identifiers are retained; automatic template-profile selection is not implemented.

## Validation and compatibility

`canonicalPdd` supplies defaults for unversioned reader/legacy fragments, preserves values/evidence without mutating callers, derives mapping/coverage and validates. Already-versioned CPMs must validate **before** rebinding/defaulting; corrupt records are not silently repaired. `validateCanonicalPdd` returns issues; failures throw `code = "INVALID_PDD"` with an `issues[]` list.

Validation covers required collection/object/text shapes, supported types, unique UIDs and exception/rule/test IDs, source locators, metadata statuses and exception-state links. It does not establish correct prose classification or implemented requirements. Keep semantic fixtures alongside contract tests.

The builder validates/upgrades PDD input at its own boundary, so programmatic imports cannot bypass the contract. Saved sessions remain snapshots: loading an old model does not invoke the new parser or manufacture provenance. New `_pdd` and import-report data survive existing session serialization without a Process Model migration.

From the v0.69 development milestone, included in public v0.70, converter output is a document candidate, not automatically selected requirements. A separate [document-role review](PROJECT_CONTEXT.md) uses content and supplied code/config references, with manual override and explicit PDD selection. Among likely PDDs JSON has default priority and equal-priority candidates keep input order; the user can select another or none. Malformed candidates are reported and cannot be used as a PDD. Configuration is separate project context, not part of the canonical PDD. Cross-document comparison/merging, AI extraction, PDF parsing and Flowchart route simulation are not included.

## Verification

Run `node --test tests/*.test.cjs`. `tests/pdd-contract.test.cjs` covers contract parity, optional metadata, EN/RO aliases, original locators, injected converters, invalid candidates, future/corrupt versions, IDs, nonmutation, serialization and semantic boundaries. Existing parser tests cover legacy/lane layouts, reordered/inflected headers, repeated headings, banners and AS-IS exclusion. Real imports and layout still need browser checks. Do not commit private source files as fixtures.

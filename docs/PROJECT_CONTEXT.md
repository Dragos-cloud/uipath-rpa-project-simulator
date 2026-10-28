# Project documents and configuration (v0.70)

## Review before building

An imported Word file is a document candidate, not automatically a PDD. The review screen suggests one of three roles:

- **Likely PDD:** supported structured process steps plus design-related headings/title or supporting requirements; supported JSON PDD steps also qualify.
- **Operational document / bot template:** no sufficient PDD evidence, with a supported reference from supplied code/config to that imported document.
- **Needs review:** insufficient evidence, ambiguous file/key references, conflicting requirements/operational evidence, or a failed document reader.

These are suggestions, not semantic certainty. A filename alone cannot establish the role. Narrative-only or unsupported PDD layouts may need manual confirmation or parser improvements. A failed reader cannot be overridden into a usable PDD.

Correct roles and explicitly select **one** requirements document, or **No PDD — review code only**. JSON has default priority among likely PDDs; ties keep input order. You can select another eligible document. Other documents are not merged into requirements, mappings, coverage or PDD gap checks. In a multi-project import each scoped project gets its own review.

## Supported config snapshot

The dependency-free reader accepts `.xlsx` filenames beginning `Config` or `Settings`, optionally followed by a dot, underscore, space or hyphen suffix (for example `Config-dev.xlsx`). Other data workbooks, `.xls` and `.xlsm` are not imported. It reads only **Settings**, **Constants** and **Assets** sheets with supported Name/Key + Value headers (also Nume/Cheie + Valoare), found within the first 20 rows. Shared strings, inline strings, booleans, empty cells and reordered columns are supported.

Source locations retain workbook-relative filename, sheet, key cell and value cell. Exact literal `Config("Key")`, `in_Config("Key")` and C# indexer references are inventoried in supported XAML attributes/argument properties. Recognized direct config arguments passed to a uniquely identified child workflow can be linked one hop to a document-file operation. This is not arbitrary expression/data-flow evaluation, reachability analysis or proof of runtime use.

Document matching uses relative paths first, then a path suffix from an old absolute location, then a unique filename. Only **already imported** DOCX files may be linked; no original location is opened. Ambiguous filenames or duplicate config keys stay ambiguous. Config references without recognized code use do not automatically classify a template as operational. The UI shows workbook cells, relevant code references and supported child file operations.

## Privacy and execution boundary

- Sensitive setting rows (credential, password, token, account, email and related key names) are omitted entirely; only their count remains.
- Other values are hidden by default. The allowlist retains retry integers 0–1000, boolean/0/1 test-mode values and HTTP(S) **origins** without URL credentials. URL paths, query strings and fragments are discarded.
- Template/file values retain only matches to imported documents; raw full paths are discarded. Queue names, arbitrary settings, descriptions, formula text and cached formula results are not retained.
- Asset names/values are not resolved. Asset rows say the value is supplied at runtime. Formulas are labelled, not evaluated. Macros and external relationships are not followed or executed; XML entity/DTD declarations are rejected.
- Config input is limited to 8 MB compressed, 500 ZIP entries, 4 MB per XML entry, 8 MB total XML, 20,000 cells per supported sheet and 2,000 rows per sheet. Limits fail visibly instead of silently truncating settings. Code-use references are capped at 80 per setting and linked child operations at 20.

The resulting optional `_projectContext` snapshot contains sanitized configuration, document roles, references and unresolved nonsensitive setting keys. It is retained in the session, shown under **Gaps → Project documents and configuration**, included in the gap Markdown export, and provided as bounded context to general AI briefing/questions that use the project context. Unselected document contents are not included there. These controls apply to newly read config data; they are not a general-purpose secret scrubber for every supplied workflow/PDD or user-edited session. Review source material before sharing exports or enabling a nonlocal model endpoint.

An imported setting is not necessarily its effective runtime value: assignments, other config files, arguments or Orchestrator assets may override it. An unresolved setting key means only “not found in the supplied config,” not “missing at runtime.” Config never establishes business requirements or implemented behavior.

## Configuration in Step details (v0.70)

Click a process card to open **Configuration used by this step**. The section shows setting categories, approved values or a reason for hiding/unavailability, linked imported document names and source cells. Expand **Show where this comes from** for the key, full imported-relative source paths and code references. Code/config files are never opened as external links.

Scope comes from explicit model metadata, not name/description matching. An invoked-workflow card inventories references in that workflow, including error handling, but does not automatically include descendants' settings. Inline cards include their own activity subtree, not sibling activities; decisions use the decision activity itself. Direct one-hop config-to-template/file arguments are tied to the exact caller activity, so repeated calls to a child cannot borrow each other's config keys. Ambiguous workflow identity produces no guessed association. Arbitrary expressions, dictionary aliases, multi-hop propagation, assignments/overrides and runtime reachability are not evaluated.

Duplicate settings show separate candidate rows; a formula, asset or hidden value is never promoted to an effective runtime value. Unknown keys are explicitly not found in the supplied config, not necessarily missing at runtime. Empty results mean no supported reference was found, not that the step has no settings. Per card, the inspector keeps at most 40 keys, eight distinct code references per key and eight candidate config rows, with explicit notices for omitted items.

Optional step `configSource` and version-1 `configEvidence` metadata survive schema-1 session save/load. Unsupported/malformed optional evidence gets re-import guidance rather than breaking the inspector or rendering unapproved values. Older sessions without evidence need source re-import. Samples and assumed exception steps do not acquire guessed settings. On narrow screens the inspector stays within the visible browser area.

The step-specific enrichment in this release implements Step details only. It does not add these per-step bindings to Explain, change existing Brief/Ask context, enrich PDD drafts, or change labels, scenarios, execution, durations, requirements mappings or gaps. The generated PDD/session schemas remain unchanged. The PDF drafts have not been updated. The separately published short uses earlier synthetic demo footage; it does not demonstrate this new configuration inspector.

## Compatibility and checks

The Process Model session schema and canonical PDD schema remain version 1. Old sessions have no project-context snapshot and continue to load without one. Re-import the original folder to obtain new evidence; loading a saved model does not re-read source/config files. Source files are never modified.

Run `node --test tests/*.test.cjs`. Synthetic project-context tests cover role decisions/overrides, selection, safe config values, formulas/assets, ambiguous references, one-hop arguments, source locators, OOXML relationship boundaries, ZIP limits, escaping and EN/RO parity. Real-browser import checks are separate from fixture DOM tests. No private project files are test fixtures.

# RPA Project Simulator — Product Handbook

**Version covered:** 0.70 — the number is the `APP_VERSION` constant, shown next to the app name in the header (as implemented in [`index.html`](index.html)). Bump it on every code change so the running app identifies what it contains; the release notes are in [CHANGELOG.md](CHANGELOG.md).
**Format:** a single self-contained HTML file — no build step, no server, no external dependencies. Opens directly in a browser.

---

## 1. What this product is

RPA Project Simulator is an independent browser-based tool that turns supported UiPath™ project files (workflows plus an optional process design document) into an interactive review model for business analysts, RPA developers, stakeholders, and trainers. The main workflow starts with **Import project…**; the included samples demonstrate the controls. The model interprets supplied material; it does not execute workflows or certify project compatibility.

It lets a reviewer:

- **Walk through the process step by step**, inspecting the model's actor labels, activities and source references. Imported human/persistence boundaries may be incomplete and require source review.
- **Inject supported, code-evidenced exceptions** and explore the retry/recovery/escalation paths the model can represent; predefined samples also include authored training scenarios.
- **Compare the process design document (PDD) with imported UiPath evidence** and investigate mapping and exception-review findings. This is not an exhaustive implementation or defect audit.
- **Ask a local LLM** (via LM Studio, running entirely on the user's machine) to explain a step or brief a room before a walkthrough.

Parsing and simulation execute client-side. When an AI feature is enabled, the app sends process context to the LLM endpoint the user configures. A local endpoint keeps those requests on the machine; a remote endpoint may send them outside the machine or network. Use only an endpoint approved for the sensitivity of the imported material.

**Hosted app:** [Open the live app](https://dragos-cloud.github.io/uipath-rpa-project-simulator/). The app name is RPA Project Simulator; the author has chosen to retain the existing repository and Pages URLs. GitHub Pages publishes the static repository root from `main`; `.nojekyll` disables Jekyll processing. No server-side project execution or shared AI service is introduced. Visitors who use local AI must run and configure their own endpoint; browser/CORS restrictions may require using a local copy instead.

### Primary users
- **Business analysts** documenting or validating a TO-BE process.
- **RPA developers** cross-checking that what they built matches what was signed off.
- **Stakeholders** reviewing the process, responsibilities, and exceptions in business language.
- **Trainers / delivery leads** running walkthroughs and workshops from project material.

This is an independent community tool developed by Dragos Marin, not affiliated with, sponsored by, or endorsed by UiPath. UiPath™ is a trademark of UiPath, Inc. and UiPath SRL. Platform names identify supported source formats/interoperability, not the app's publisher. No permission or certification is claimed. The footer and both guide languages carry notices.

### Included example content
Two hand-authored sample processes ship in the app (`SAMPLES.invoice`, `SAMPLES.onboarding`) for learning the controls before importing your own project:
- **AP Invoice Processing** — a REFramework, queue-based process with OCR extraction, SAP posting, and five exception scenarios (recoverable system exception, business exception, non-recoverable system exception, empty-queue "exception", terminal credential failure).
- **Employee Onboarding** — an attended, hand-off-heavy process across AD/M365/Workday/ServiceNow with two deliberate human approval gates and four exception scenarios, including a business exception that pauses for a human decision without killing the run.

The repository deliberately contains only the generic samples. Import a local copy of a UiPath project when evaluating the parser; do not commit client process files or PDDs.

### Public walkthrough

The [3:28 v0.63 walkthrough](docs/demo/README.md) presents the app for BAs, RPA developers, stakeholders and trainers, using a synthetic Customer Order Processing import. It distinguishes decision-route scenarios from exception injection, opens inspectors in app context, holds the PDD/code comparison for reading, and highlights controls. Actual local-model briefings, explanations and questions are followed by source-check cautions. Training examples come last. Source comparisons are manual review observations, not claims of automated defect detection or runtime success. The video and English subtitles are attached to the [v0.63 release](https://github.com/Dragos-cloud/uipath-rpa-project-simulator/releases/tag/v0.63); the [v0.61 release](https://github.com/Dragos-cloud/uipath-rpa-project-simulator/releases/tag/v0.61) is preserved unchanged as an archive.

---

## 2. Core data model — the "Process Model"

Every part of the app (diagram, timeline, exception dropdown, LLM prompts, import builder) reads and writes one JSON structure. This is the contract that decouples "how we got the data" (hand-authored / parsed from XAML+PDD) from "how it is simulated."

```json
{
  "meta": { "id": "...", "name": "...", "description": "...", "source": "...",
            "framework": true },   // optional: false = not an REFramework project (no framework steps/handlers); absent = true
  "steps": [
    {
      "id": "s1",
      "name": "Post invoice in SAP",
      "actor": "bot",              // bot | human | system
      "app": "SAP GUI",
      "ms": 7800,                  // simulated duration
      "gate": false,               // true = halt and wait for the user
      "gatePrompt": "...",         // shown on the amber card
      "branch": "main",            // main | exception
      "detail": "plain-English description",
      "log": "line the robot writes to Orchestrator",
      "logFail": "optional: what the step is attempting — shown instead of 'log' when this attempt fails",
      "afterRun": false,           // optional: human step after the robot has finished (changes gate wording)
      "kind": "step",              // optional: "gateway" = a decision (diamond) — see the rules below
      "when": ["if files.Count = 1"], // optional (imported projects): the If/Else/loop conditions the step sits inside, as text — shown as ⑂ <innermost condition> on the card + a "Runs only when" block
      "dec": [{ "id": "main#16", "br": "then" }], // optional (imported projects): the routing decisions the step sits inside, machine-usable — drives the Scenario selector; id is unique per decision AND call path
      "source": { "pdd": "§4.6", "xaml": "Process.xaml > Post Invoice" }
    }
  ],
  "exceptions": [
    {
      "id": "e1",
      "name": "SAP not responding",
      "class": "system",           // system | business
      "trigger": "s9",             // step id where it fires
      "retry": { "count": 3 },
      "retryPath": ["x1", "x2"],   // steps run before each retry
      "recovers": true,            // succeeds on the final attempt
      "path": ["x3", "x4"],        // steps run once retries are exhausted
      "resume": "g1",              // rejoin the main flow here (a loop's gateway, to carry on with the queue)
      "terminal": false,           // true = stop the run
      "benignStop": false,         // optional, with terminal: ends "Completed — no work", not a red "Stopped"
      "firesAfter": false,         // optional: the Throw sits in the entry workflow between steps, so "trigger" is the step that ran just BEFORE it — labels say "fires after", not "at"
      "detail": "what a BA should understand about this failure",
      "source": "xaml"             // xaml | pdd | user
    }
  ]
}
```

Rules baked into the engine:
- Exception handler steps live in `steps[]` with `branch:"exception"`.
- An exception fires **once** per run, at its trigger step.
- `terminal` beats `resume`.
- A `resume` target is just where the main steps are re-played from, with the exception already spent — so resuming at a loop's *first step* replays the same transaction as if it had been fixed. To carry on with the rest of a queue, resume at the loop's **gateway** (e.g. "More items in queue?"), which decides between the next item and the run-end steps.
- A gateway with `decision:true` (inferred from the XAML, never hand-authored) has no `loopTo`/`items`: it is a diamond placed just before the first step it governs, carries `decId` and `dec` (the decisions it is nested in), and tells the player which way a Scenario sent it. Steps whose `dec` disagrees with the chosen scenario — or whose invoking step was skipped — are left out of the run plan and dimmed.
- A step with `kind:"gateway"` is a decision, drawn as a diamond. It needs `loopTo` (the step its **Yes** exit returns to; **No** is simply the next main step) and `items` — one object per loop pass, so `items.length` is the queue size and the Yes exit is taken `items.length − 1` times. Text in `log`/`logFail`/`detail` may use `{n}`, `{total}`, `{left}` and any key of the current item (`{inv}`, `{po}`, …); they are filled per pass so item 2 prints item 2's values. Unknown `{…}` text is left as written.
- The timeline prints a step's `log` before the exception fires, so a trigger step's `log` must not assert success; give it a `logFail` describing the attempt.
- A handler gate (`gate:true` inside an exception path) means the robot is genuinely waiting for an answer it will act on. If a person only needs to be told (clerk, support, HR), use a non-blocking notification step and let the flow continue or stop.
- Omitting `retry` means the handler runs immediately — the correct shape for a business exception (retrying identical bad data produces an identical failure).

### 2.1 Fields the importer adds (all optional — a hand-authored model needs none of them)

Listed from models the app builds from imported projects; the engine ignores any field it does not know.

**Top level of a built model**
| Field | Meaning |
|---|---|
| `_gaps` | the gap-report list: `{ kind, sev, title, detail, info?, covKind?, covIdx? }`. `info:true` = a note, not a defect (excluded from the toolbar badge). `covKind`/`covIdx` tie a gap to a row of the coverage matrix |
| `_coverage` | `{ thrown[], documented[] }` — the exception coverage matrix: each row has the text, `best` match, similarity `score` and `band` (likely / possible / none) |
| `_importReport` | optional v1 report with the import/build app version, parsed source identities, chosen PDD, counts and route-support limits, source errors/warnings and distinct missing workflows; retained by Save session and the gap Markdown export |
| `errorEvidence` | optional v1 inventory of all supplied XAML: workflow-local recognized raises, Catch types and protected regions, handler activities/literal statuses, Finally and Rethrow; structural source evidence, not runtime execution or verified reachability |
| `coverageDecisions` | `{ thrown:{ rowIndex:'confirmed'\|'rejected' }, documented:{ … } }` — the person's accept/reject decisions on pairings; written when the first decision is made |

**`meta`**
| Field | Meaning |
|---|---|
| `id`, `name`, `description`, `source` | identity (`name`/`description` come from `project.json`, then the PDD) and a one-line "28 XAML + PDD .docx" |
| `version`, `code`, `ops`, `testCases` | read from the PDD when there is one; `ops.trigger` is the editable "how does this start" text |
| `framework` | `false` = not an REFramework project (see above); absent in files from before the flag = `true` |
| `sourceFileNames` | the files the model was built from |
| `uiApp` | `{ title, forms }` when a supplied .uiapp matched this project |
| `plainNames` | `true` while the ✦ Plain names labels are shown |
| `schema`, `appVersion` | format version and the app version that **saved** the file — written by Save session only (see 2.2) |

**Steps** (beyond the fields above)
| Field | Meaning |
|---|---|
| `fw` / `synth` / `promoted` / `inline` | a collapsed REFramework step · an *assumed* handler step the app supplies (hidden unless "Assumed steps" is on) · a step found inside a framework workflow that is shown as a process step · a step read from a titled section inside a workflow |
| `msAssumed` | `ms` is an estimate, not a measurement |
| `nestDepth` | how deep the step sits under a parent step (drives the indent) |
| `xamlName`, `xamlTarget`, `resolved`, `ext` | the workflow the step runs: its own name, the path in `InvokeWorkflowFile`, whether the file was supplied, and its extension (a non-`xaml` one is a coded workflow, a black box) |
| `nameSrc` | where the label came from: `typed` (the author's DisplayName) · `annotation` · `title` (the root activity's title) · `identifier` (the humanised file name) |
| `does`, `props`, `tgt` | what an inline step is set to do: a sentence, the whitelisted settings (`{k, v, x, via}` — `x` = a calculated value, `via` = the variable it came from) and the target (`sel` the selector, `page`, `el` element type, `tag`, `id`, `label`, `app`, `title`) |
| `scoped`, `actTag`, `within` | a step read out of a scope or loop (see §3.3): the activity type (`TypeInto`, `NClick`…) and the names of the sections around it, outermost first — what ✦ Plain names uses |
| `plain`, `plainOrig` | the model-written label and the label it replaced (✦ Plain names) |
| `args`, `occ`, `diff` | the arguments of the call; `occ:{n,of}` when the same workflow is called more than once; `diff` = the arguments whose values differ between those calls |
| `sub`, `logs` | the activities inside the workflow (name, tag, annotation) and its `LogMessage` texts |
| `pddRef`, `pddIdx`, `pddDetail` | the matched PDD section, for the inspector's "According to the PDD" block |
| `decision`, `decId`, `inline` on a gateway | a decision inferred from an `If` (`decision:true`, `decId` = the decision it stands for; informational flowchart diamonds have `inline:true` and are not simulated) |

**Exceptions** (beyond the fields above): `retryAssumed` — the retry count is the framework's standard one, not read from the code; `firesAfter` — see the JSON above; `handlingUnverified` — an enclosing Catch is structurally present, so injection ends at **Review required** without inventing handler selection, retry or recovery.

### Exception evidence boundaries (v0.64)

Scenario derives decision-route assumptions. Inject exception uses supported explicit raises mapped to process steps, or manually authored failures in included samples. Exception evidence separately retains code-defined handling, including Catch-only workflows whose activities can fail implicitly. Zero injectable failures does not establish that business/system handling is absent.

Catch type arguments are resolved through declared XML namespaces when possible. `System.Exception` is general, `UiPath.Core.BusinessRuleException` is business-typed, recognised `System.*Exception` names are system-typed, and custom/unresolved names remain unknown. These labels describe source types, not the cause or runtime type of a failure. Enclosing Try regions provide candidates only; CLR inheritance, Catch selection, call-site propagation, conditional handler execution and successful recovery are not evaluated. Handler/Finally-only workflow calls are retained as evidence, not inserted into the ordinary invocation spine. Finally is displayed separately, not treated as an exception.

Recognized inline raises are limited to a literal-message `throw new` / `Throw New` subset; constructor creation alone, supported string/comment forms and variable throws are not treated as injectable raises. This is not a full C#/VB parser or exhaustive failure analysis. The inventory covers all supplied workflows, including unreferenced helpers/tests. Re-import old sessions to obtain it; new sessions preserve the optional inventory without changing schema 1.

The evidence panel, matching card inspectors, gap report/export, generated PDD draft and bounded AI context use the same inventory. A generated PDD is still a review draft; an LLM explanation is not proof that handling executes successfully.

In v0.65 the default evidence view leads with business activity names, work covered by each response and actions written for an error. Technical details retain types, tags, literal variable assignments and parser limits. Explain in the panel uses the configured local-model connection and response language (Auto follows the interface language for this view), provides an explicitly unverified interpretation and a separate Markdown export. Opening the panel does not call AI; missing configuration sends no request. Closing, switching projects or changing language invalidates the displayed answer and any pending reply. The request itself is not aborted at the server, but an obsolete reply cannot populate the new view. Raw source remains accessible without AI.

### 2.2 The saved-session file (`.rpaproj.json`)

"Save session…" writes the model above (including `_gaps`, `_coverage`, `coverageDecisions`) with two extra `meta` fields: **`schema`** (the format number — currently **1**) and **`appVersion`**. "Load session…" validates and upgrades the file before anything is drawn:
- it must be a JSON object with a `steps[]` array; every step needs a unique `id` (a missing `name` falls back to the id); a missing `exceptions` becomes `[]`;
- no `schema` = a file saved before versioning (format 0): it is upgraded step by step (`MIGRATIONS` in the code) — today that only makes the REFramework flag explicit;
- a `schema` **newer** than this app reads is refused with a message naming the app version that wrote it, rather than being half-understood.

**Rule for changing the model:** a change that an older reader would misread (a renamed or re-shaped field) must bump `SCHEMA_VERSION` and add a `MIGRATIONS` step in the same change, with a test. Adding an optional field needs neither.

### 2.3 Import review and parser revision (v0.66)

The local revision fixes legacy Romanian action-header inflections, exception action/reference aliases and General information being mistaken for process work. Merged single-cell group banners and repeated headings are excluded, AS-IS remains separate, and document/process metadata is retained. The manifest name wins when supplied; otherwise a useful workflow class or the PDD name supplies identity, not an arbitrary first file.

Gaps includes Import review with the app version, entry/process files, PDD source, parsed counts, source errors, unsupported route forms and missing dependencies. Table diagnostics include header text. Unrelated JSON without supported PDD fields is skipped with a warning. From v0.69, JSON has default priority only among likely PDD candidates; users confirm document roles and choose the PDD (or none). Multiple sources are not merged.

Scenario remains visible but disabled when no supported structured If/Else routes can be built. Flowchart decisions and back-references are not simulated as selectable paths; no routes are fabricated from lexical XML nesting or from the PDD. An existing saved model is a snapshot, not the original Word/XAML source: re-import after parser corrections. See the dated changelog for observed before/after counts, end-to-end checks and remaining limits. The v0.64 PDF has not been regenerated for this revision.

---

### 2.4 Canonical PDD foundation (v0.67)

JSON and DOCX readers now emit the same versioned Canonical PDD Model (CPM). Required arrays and typed records are validated before mapping and again at the builder boundary. Invalid shapes, unsupported PDD versions, duplicate IDs and broken exception-state links fail explicitly; empty requirements are not silently substituted for malformed input. A valid structure still does not certify correct or complete extraction.

The function-based converter registry dispatches by extension and accepts injected readers/registries for testing. Word XML/style extraction, ordered-block interpretation and JSON-specific field mapping remain outside the simulator. BPMN is still only a task-name cross-check. No framework, dependencies or build step were added.

Optional metadata includes document revision/date/author, template identifier and expected scope. EN/RO **Document details and sources / Detalii și surse ale documentului** shows values as provided, detected or unknown with original JSON Pointers or Word table/row/block locations. Missing fields stay unknown and do not block import. Template identifiers are retained but do not select new template profiles. Application-name consumers remain compatible through a separate evidence list; operational details also retain evidence.

The PDD contract version, parser version, document revision and saved-session schema are independent. The Process Model schema remains 1. Existing sessions stay snapshots; re-import sources for new extraction/evidence. No automatic metadata editing, cross-document comparison/merge, AI extraction, PDF support or Flowchart scenarios are added. The previously generated PDF manual remains v0.64. See [docs/PDD_MODEL.md](docs/PDD_MODEL.md) for fields, extension points and compatibility rules.

### 2.5 Legacy XAML compatibility (v0.68)

Some older Studio projects serialize qualified assembly identities containing literal spaces in CLR namespace URIs. The browser's XML parser rejects these declarations before the app can read their activities, even though the .NET XML reader accepts them. `normalizeLegacyXamlNamespaces` makes a temporary compatibility copy: it percent-encodes whitespace only after `;assembly=` in actual `xmlns` values starting with `clr-namespace:`. Prefixes, CLR namespace names and assembly identity are retained; no DLL is loaded or workflow executed.

The lexical pass skips comments, CDATA, processing instructions and declarations/DTD subsets, and consumes whole quoted attributes so namespace-looking text in code/selectors/messages is not rewritten. Numeric whitespace references in assembly names are handled as well; already escaped declarations are not double encoded. This does not add DTD/entity support or repair arbitrary malformed XML. Remaining errors include a bounded browser diagnostic; any line/column refers to the parsed compatibility copy when adaptation occurred.

Parsed workflows retain optional `xmlCompatibility` evidence. Import review summarizes affected workflows/counts in English/Romanian and saved sessions/Markdown exports retain original/adapted namespace values. Old reports without this optional data still render. Saved Process Model schema remains 1, CPM schema remains 1, and Flowchart route limitations are unchanged. Re-import original sources after upgrading; a previously saved incomplete model cannot recover omitted source workflows.

### 2.6 Configuration in Step details (v0.70)

Open a process card and look for **Configuration used by this step**. A linked template is shown by filename; approved retry/test-mode values and website origins can be displayed, while other values remain hidden or marked runtime-supplied. Expand **Show where this comes from** for the setting key, workbook cell, original imported-relative paths and code reference. A direct supported argument forwarded by the caller is tied to that call, not every call to the same workflow.

References are limited to the card's workflow, inline activity subtree or decision activity. Child workflows are not automatically included. Duplicate rows remain visible alternatives, unknown keys are only "not found in supplied config," and missing/ambiguous scopes do not get guessed associations. Empty results do not establish that no settings exist. Re-import sources for old sessions; new evidence survives schema-1 save/load. The inspector stays inside the browser area on narrow screens. Explain, Brief/Ask and generated PDD-draft enrichment are unchanged in this phase. See [the exact support and privacy limits](docs/PROJECT_CONTEXT.md).

## 3. Existing functionality

### 3.1 Simulator view (main screen)

| Area | Behaviour |
|---|---|
| **Process picker** | Dropdown of built-in samples + any imported/loaded model. |
| **Diagram (left pane)** | Auto-laid-out flowchart, one column for the main flow and a second column for the currently armed exception's handler path. Node color/border encodes actor (bot=blue, human=amber, system=purple) and state (queued, active, done). Text wraps and truncates based on measured glyph width — there is no fixed box height; it derives from content. |
| **Playback controls** | Play / Pause, single Step, Reset, and a 10-position speed slider (0.25× to 10×). Keyboard shortcuts: `Space` play/pause, `→` step, `R` reset. |
| **Human gates** | A step with `gate:true` halts the run and shows an amber "Human action required" card with a custom prompt; the robot does not resume until the user clicks "Done — continue." The elapsed wait is measured and reported separately from bot time. |
| **Timeline (right pane)** | A scrolling, color-coded log of every event as it happens (step start, retry, recovery, escalation, resume, end), each with icon, actor pill, and detail text. |
| **Stats bar** | Live counters: steps completed / total, cumulative bot time, cumulative human wait time, and final outcome (Completed / Stopped, with the triggering exception class). |
| **Inspector** | Click any diagram node to open a floating, resizable panel: actor, system touched, duration (flagged `~estimated` when synthesized), PDD/XAML source references, the workflow's internal activity list (when parsed from real XAML), and the log line the robot would write. An `Invoke Code` activity in that list shows a real preview of its actual VB/C# (first few lines, with a count of how many more), tagged with its language, instead of an unlabelled black box. Remembers its own size per window-size bucket (small/medium/large) and auto-flips sides to avoid covering the active step. |
| **Resizable diagram/timeline split** | A grip sitting exactly on the boundary between the two panes lets either be widened at the other's expense — useful when a long process or step name doesn't fit the default 420px timeline column, or when a narrow window leaves the diagram squeezed to almost nothing. Drag to resize, double-click to reset to the 420px default; remembered per window-size bucket, same as the inspector. |
| **Exception injection** | A dropdown of every exception in the loaded model (▸ business / ⚡ system). Arming one redraws the diagram immediately — before pressing Play — so the handler path can be discussed with a stakeholder first. |
| **Framework-steps toggle** | REFramework plumbing (`InitAllSettings`, `GetTransactionData`, `SetTransactionStatus`, `CloseAllApplications`, etc.) collapses into a single summary node by default so the business logic stays legible; a checkbox expands it back out for a technical audience. |
| **Assumed-steps toggle** | An imported project's exception handlers (take screenshot, close/reopen, mark failed, notify) are the app's own generic assumption about standard REFramework behavior — not something found in the supplied XAML or PDD (they're marked `synth:true`, built by `frameworkHandlers()`). Left on by default they look identical to verified content, which is exactly backwards for a tool meant to show what the PDD and code actually say — so they're **hidden by default**, in the diagram, the execution timeline, and therefore in every export, and only appear when this checkbox is explicitly turned on. Same underlying filter (`excHandlerIds()`/`pushHandlerStep()`) is shared by the diagram layout, the edges drawn between nodes, and the run plan, so all three always agree on what's currently visible. |
| **Full session persistence** | **Save session…** exports the built Process Model, confirmed mappings, exceptions, gaps, coverage decisions, and source filenames as one `<process-name>.rpaproj.json`. **Load session…** restores it without re-parsing the original files. The session records its schema and app version; loading validates the shape, upgrades older formats, and rejects newer unsupported formats with a clear message. See section 2.2 for the saved-session contract. |
| **Bilingual UI** | Full English/Romanian toggle, including the entire embedded User Guide. |
| **Export everywhere** | Every generated artifact in the app can be saved to disk, not just the gap report: the **process flow diagram** (an "Export .svg" button in its pane header exports a standalone, self-styled SVG snapshot of the current diagram, including whichever steps are marked done/active and whichever exception's handler path is currently drawn), the **execution timeline** ("Export .md" in its pane header turns everything played so far — including pill metadata — into a Markdown log with the run's outcome and bot/human time totals), and any individual **✦ Explain** or **✦ Brief me** answer (an "Export .md" button appears next to the answer itself once the local LLM responds, and only then — nothing appears next to a failed or unconfigured request). All exports share one filename convention (`<process-name>-...`) via a common download helper. |

### 3.2 Exception handling model

The simulator explicitly separates two exception classes, because the distinction drives real RPA design decisions:

| | System exception | Business exception |
|---|---|---|
| Cause | Environment misbehaved | Data is wrong |
| Retry | Yes — often recovers | No — identical input fails identically |
| Queue status | Failed (Application) | Failed (Business Rule) |
| Routed to | RPA support | The business team |

Modeled outcomes, all demonstrable via the sample processes:
- **Retry loop with recovery** — handler runs, step re-attempted, succeeds before retries are exhausted.
- **Retry loop with escalation** — retries exhausted, handler path runs, human/support step engaged, run may or may not continue.
- **Resume** — the failed transaction is abandoned but the run continues with the next item (queue-based design).
- **Terminal stop** — the whole run halts (e.g. expired credential, duplicate payroll record).
- **Human escalation inside a handler** — an exception path can itself contain a `gate` step (e.g. "confirm rehire vs. name collision" before continuing).

**Only code-verified exceptions are injectable.** For an imported project, an exception documented in the PDD is only added to the model — and therefore only offered in the "Inject exception" dropdown — when it confidently matches a real `Throw` found in the supplied XAML (the two get merged into one exception, `source:"xaml+pdd"`). A PDD exception with no confident match is reported in the gap report (as `exc-weak` or `exc-unimplemented`, depending on match strength) and nothing else: simulating it would mean inventing its trigger point, retry count and handler path from the REFramework default, which is exactly the kind of derived content the map/timeline is meant to exclude — the same rule already applied to individual assumed handler steps, extended to whole exceptions that only exist on paper.

### 3.3 Project import pipeline (turns a real UiPath project into a model)

Triggered by **Import project…**. The user drops every relevant file at once; parsing happens locally with in-browser APIs (`DOMParser`, native `DecompressionStream` for `.docx` and supported config `.xlsx` files). Optional AI features send bounded context to the configured model endpoint.

**Document roles and config context (v0.69).** Before mapping, confirm likely PDD / operational document or bot template / needs review. Suggestions combine supported requirements content with supplied code/config references. Choose one PDD or continue with code only; no operational template is silently promoted to requirements. Config/Settings `.xlsx` workbooks contribute sanitized Settings/Constants/Assets entries, source cells, symbolic Config lookups and supported one-hop child document operations. Most values are withheld; sensitive rows are omitted, formulas and external links are not executed, and only imported document links replace raw template paths. Values retained by the allowlist are retry integers, test-mode booleans and credential-free website origins. This context is not requirements, runtime validation or a project-wide secret scrubber. **Gaps → Project documents and configuration**, session saves, Markdown gap exports and general AI project context retain the sanitized snapshot. See [the detailed support/privacy boundary](docs/PROJECT_CONTEXT.md). Existing sessions remain schema 1; re-import to obtain the new evidence.

| File type | What is extracted |
|---|---|
| `.xaml` | Full activity tree, `DisplayName`s, annotations, `Try/Catch` counts, `Throw` exception messages (with class inferred from `BusinessRuleException` vs. generic `Exception`), `LogMessage` text, `InvokeWorkflowFile` links (used to reconstruct the call graph), `FlowDecision`/`If` conditions, and an **Invoke Code** activity's actual inline VB/C# (its `Code` attribute is plain text, not compiled — genuinely easier to read than a coded workflow). Any `Throw New ...Exception("...")` / `throw new ...Exception("...")` found inside that code is extracted the same way as a real `<Throw>` activity's message, feeding the exact same exception pipeline (gap report, coverage matrix, "Inject exception") with no separate mechanism needed. REFramework files are auto-detected by class/filename. |
| `.cs` | Registered as a "coded workflow" — flagged as an unparseable black box in the gap report (its exceptions are invisible to the coverage matrix). |
| `.json` (PDD export) | The richest source: sections, per-section steps, business/system exception tables, human-intervention points, applications used, notification rules, test cases, operational parameters (volume, trigger type, run window, criticality). |
| `.docx` (PDD as Word) | Unzipped and parsed as OOXML directly in the browser (no library). Table *content*, not a fixed heading number or exact phrase, decides what each table is — see below. |
| `.bpmn` | Read only as a naming cross-check (task/subprocess names). |

If both a `.json` and a `.docx` PDD are supplied, the JSON wins (it carries structure the Word file does not).

**PDD structure compatibility.** Word imports use semantic column roles rather than fixed column positions. Legacy English/Romanian step, exception and intervention tables remain supported. Lane-oriented tables with `#`, `BPMN element`, `Element type` and `Description` become typed process groups; gateways and events are retained as such, while activity rows are offered as mapping targets. Headings establish current/future-state scope using AS-IS/TO-BE, Current/Future State and supported Romanian equivalents. Summary, current-state, data-movement and next-step tables are not duplicated into the target flow.

Exception definitions and exception state transitions remain separate. A business/system type must come from an explicit heading or class column; otherwise it stays unspecified. Target handling is kept separately from AS-IS handling. Human task forms are read as documented requirements, not prepended to the simulation as invented human gates. Rules, open constraints, application names, scope exclusions and document identity are extracted where supported. Every extracted step, rule, task and exception carries its heading/table/row reference. Unrecognised tables remain visible in the PDD readout's diagnostics rather than silently counting as covered content. This is structured extraction, not universal interpretation of arbitrary prose or embedded diagrams.

**Mapping and AI context.** Calls from either REFramework Process.xaml or the declared non-REFramework entry workflow can be mapped to PDD requirements. Text similarity suggestions must be checked; a confirmed mapping is a source association, not proof of implementation. Missing mappings and missing Throw evidence are review findings, since branches, statuses, catches or external tasks can implement documented outcomes. Parsed PDD data is retained in the saved session. Brief me and Ask receive a bounded requirements context clearly separated from observed step/exception facts, with truncation disclosed. Explain receives the selected step's mapped requirement when available. Unsupported persistence/human-wait semantics still require source review.

**Folder ingestion.** A real UiPath solution is rarely a flat pile of files — a project's activities live under `Framework/`, `DataLayer/`, `BusinessLayer/`, etc., and a multi-project solution (a Dispatcher/Performer pair, for instance) is several such project folders side by side. The import modal accepts a whole directory tree, two ways: an **"Or choose an entire folder…"** button (native folder picker), or dropping a folder straight onto the drop zone (walked recursively via the File System Entries API, handling the browser's paginated `readEntries()` correctly so a large tree isn't silently truncated). Either path preserves each file's relative path, which is also what makes the app safe against a name collision — e.g. two different projects both having a `Main.xaml` — that a bare-filename comparison would silently merge.

Two things make this practical rather than just possible:
- **Noise filtering.** Studio's own internal/cache folders (`.local`, `.objects`, `.entities`, `.autopilot`, `.templates`, `.settings`, `.tmh`, `.codedworkflows`, `.project`, plus VCS/IDE folders) and per-workflow metadata sidecars (`*.xaml.json`, `entry-points.json`) are recognized and excluded automatically — a real project folder easily contains ten times as many of these as it does actual `.xaml`/`.cs`/PDD files, and the import list shows an "N ignored" count so that's visible rather than silent.
- **`project.json` is read as what it is** — UiPath's own project manifest — rather than being fed to the PDD parser (which is what happened before: any `.json` was assumed to be a PDD export, so a project manifest would silently produce an empty, wrong PDD). Its `name`, `description`, and entry point now seed the model directly.

**Multi-project detection.** If the dropped tree contains more than one `project.json`, a picker step lists every project found (name, description, file counts) with everything pre-checked; the user chooses which to build. Each becomes an independent Process Model, exactly as if it had been imported on its own — the app deliberately does not try to guess how a Dispatcher relates to its Performer (that inference is unreliable and is tracked as a separate, larger idea in the development plan, not attempted here). A file scoped inside a project's folder belongs to that project only; a file that sits outside every detected project folder (e.g. one PDD describing the whole solution) is treated as shared and made available to whichever project is built. Building several at once still runs the existing one-project-at-a-time pipeline underneath — a project with no PDD to confirm builds straight through with no further clicks, while one that does have a PDD still gets its interactive mapping screen before the queue moves to the next project.

**Not every project in a real solution has a "Process.xaml" to show.** Some projects — commonly a Dispatcher/Performer pair's helper project, or anything built on coded workflows or UiPath Entities/Data Fabric instead of `InvokeWorkflowFile` chains — genuinely have no business logic expressed in XAML at all. Rather than silently rendering a diagram of bare framework nodes with no explanation, this is now surfaced as its own gap-report entry ("No business steps found") naming the reason. After a multi-project batch build, the app also deliberately lands on the *first* project rather than whichever happened to build last, and — if any project came back with nothing to show — names it explicitly in a short summary, rather than leaving the user staring at whichever one build finished on last and wondering if the import failed.

**Not every project is built on the REFramework either.** *(`index.html` only.)* A plain sequential `Main.xaml` that invokes a few workflows has no `Process.xaml`, no Get/Set Transaction, and no CloseAllApplications. The builder detects the framework from the supplied files (`hasFramework`: any of its workflows by name, or any XAML under a `Framework/` folder). If it is absent, framework step nodes, the standard exception handlers, and `Process.xaml` wording are omitted. The steps are what the entry workflow invokes (the `main` file declared in `project.json`), in document order, and exceptions thrown in the entry workflow are collected after the prior step. They get no invented retry or handler path; the run stops and the exception detail reports whether a Try/Catch could have intercepted it. A neutral "Not an REFramework project" note appears in the gap report.

**Routing decisions become gateways, and a Scenario follows one path.** An `If` becomes a diamond only when it chooses between steps (an Invoke Workflow File sits on a branch). Guard clauses — `If <bad input> Then Throw`, a branch that only throws — are deliberately not gateways: they are exceptions the model already has. The toolbar **Scenario** selector (shown only when a model has such decisions) lists every path through them, while **All branches (document order)** remains the default. A chosen path skips the other branches' steps (and everything those steps invoke), dims them, and records each answer on the timeline. When independent decisions would multiply into more than 24 paths, the list falls back to one entry per decision outcome ("Yes — … (this decision only)"). An armed exception whose step is on a skipped branch says it will not fire. Exception details also say when they are raised, and cards show the innermost condition.

**Lighter cards.** A card carries the name and one sub-line (system · duration). A conditional step shows just a ⑂ glyph in front of it — the condition is in the tooltip and the inspector — and the blue Δ line appears only on a repeated call. "(n/m)" repeat labels are not added to framework steps, which are collapsed plumbing.

**Framework-only projects show their real steps.** Some REFramework projects keep their work inside the framework files — Process.xaml invokes nothing — e.g. "Read emails and get attachments" under Get transaction data, or "Open Firefox & log in to Google Ads" under Initialisation. With no business spine, the steps nested under the initialisation and get-transaction roots that are not themselves template workflows (Kill Processes, Take Screenshot… stay collapsed) are shown as ordinary steps, in place, with the root left as a collapsed section marker; the no-spine note says so. Projects that do have a spine are unchanged.

**Steps read from inside Process.xaml.** When Process.xaml invokes nothing but its author titled the parts, those titles become the steps in document order: titled Sequences / Flowcharts / StateMachines (nested ones indented; Studio's default "Sequence", "Body", "Then" are ignored), every FlowDecision as a diamond (its title, else its condition), and an activity sitting directly in a flowchart step if it has a meaningful title. A Throw written inline is attached to the titled step around it — or, if it sits in an untitled flow step, "after" the last titled step before its decision, with the full chain of flowchart conditions in "Raised when". **Flowchart decisions are informational, not Scenario choices:** a Flowchart is a graph stored as a tree plus back-references, so a step defined under one outcome may also be reached from the other and which steps follow which outcome cannot be read reliably; the diamond says so. Plain `If`s around titled sections do get Scenario support.

**Modern-design workflows: scopes and loops hold the steps.** Studio's current templates wrap the work in scopes — Use Browser / Use Application, Use Excel File, Excel For Each Row — that contain a flat list of UI activities with no titled Sequence anywhere (the `EnterExcelDataintoWebsite` template: 11 actions under one "Use Browser" scope). Reading only titled Sequences left a single step, the outer scope, and hid every action. Now, when what the title-based reading finds is at most one wrapper, and the workflow has at least three titled actions, the whole tree is read: a titled scope (or a loop) that holds actions becomes a section, each titled action under it a step, nested by scope depth (capped at three). Plumbing (Set Variable Value, log, assign, delay…) and the anchor/target internals are skipped, and untitled loops are named from their type ("Excel For Each Row"). A workflow with fewer than three actions still reads as one step. The same reading covers **older, classic activities** (Open Browser › Maximize Window, Type Into 'INPUT txtName', Click 'BUTTON getNameButton', Get Text, Message Box — the "Unicorn Quick Tutorial"): inside a scope, Studio's own name for an action *is* the step, so names that merely repeat the activity type are kept. The **Application** column of the draft PDD now names what a step works in (the window of its Use Browser scope — "UiPath Demo App (Edge)" —, "Microsoft Excel" for an Excel scope, "Web browser"), not "Desktop". These steps are marked `scoped`, and **✦ Plain names** rewrites them like it does workflow steps — from the activity type, the sections around the step and its annotation (never from invented detail).

**What an inline step is set to do.** For steps read out of a workflow (not calls to other workflows) the app also reads the activity's own settings and says them in words: *Opens "https://www.rpasamples.com/suppliers" in Edge · Goes to "…" · Opens the Excel file "Suppliers.xlsx" · Repeats the steps below for each row of the "Sheet1" sheet · Types the "Internal Name" column of the current row into the input box "Internal Name*" in "UiPath Demo App" · Clicks the text "Save" · Reads the text "lblUnicornName" and keeps it as "myUnicornName" · Shows a message: "Your unicorn name is ‹myUnicornName›"*. Both shapes of XAML are read: classic activities (settings as attributes and property elements, a Target with one selector; the element's name is taken from the activity's own name when the selector has none) and the modern ones (a TargetAnchorable with full and fuzzy selectors, the page URL, the element type and the window of the scope). A variable with a literal default is resolved ("set in url"); a calculated value is shown as such. The sentence is the card text when the activity has **no annotation of its own** (an author's annotation always wins) and is always in the inspector under **What it is set to do**, with the raw settings, the page, the window and the selector (marked *technical*). It is also what ✦ Plain names is given, so a label such as "Choose the month" is written from the action, not guessed from the name. **Never read:** anything on a short exclusion list — secure text, passwords, credentials, keys, tokens — and every setting not on the short whitelist (URL, text, file/Excel path, range, sheet, table, subject, recipients, message, caption, queue, asset, item, query, process); the rest stays in the XAML.

**Inline entry workflows.** For a non-framework project whose entry workflow invokes nothing, the entry file (the `project.json` `main`, `Main.xaml`, or the only supplied XAML) is read like an inline Process.xaml: titled containers, informational flowchart decisions, titled activities, and throws attached to their surrounding step. For a flat workflow with no meaningful titles, the root's activity names become steps, excluding plumbing such as logs and assignments. An entry workflow that mixes invokes with titled sections shows both in document order; invoked work is indented under its containing section and inherits that section's decision branch. A throw inside a titled section attaches to that section; other entry-level throws follow the preceding step. Mixing titled sections and invokes in a REFramework Process.xaml is not attempted because that would change the spine used for PDD mapping.

**Steps are named in the code's own plain language, not by file name.** A step may be labelled by a one-word developer identifier (`UpdateFilePathAsset`, `Excel_ReadReport`). The label is, in order: a name the author typed if it reads like words; the lead of the call-site or workflow annotation (the text before the first colon/full stop, after dropping team-template headers such as "Component Details:"); the workflow's root-activity title if it reads like words; otherwise the identifier split into words ("Update File Path Asset"; a leading project code such as `Project3_3_` is dropped). A long annotation lead yields to a readable root title, and an over-long one is cut at a clause or truncated with "…". The technical workflow path is never lost: it is the inspector's Workflow row and the card tooltip.

**The same workflow called twice no longer looks like a duplicate.** A step records the arguments its call passes (`args`), every step that runs a workflow also run elsewhere gets `occ {n, of}`, a colliding display name gets "(n/of)", and the arguments whose values differ between the calls (compared the VB way: case- and whitespace-insensitive) are kept in `diff`. For example, two calls to a workflow can share a name and annotation but differ in a date-column input and a URL-map input; the cards show the differing values, the inspector adds a "Called with" block, and the generated PDD repeats the difference. Cards put the condition (`⑂ …`) and the `Δ` line on their own rows below the system/duration line.

**Steps know the conditions they run under.** Every parsed XAML node records where it sits in the tree, so an invoke inside an `If` carries that condition (`if files.Count = 1`, `else (not: …)`, `repeat: For Each`) as `step.when[]`. Cards show **⑂ conditional**, the inspector has a "Runs only when" block, and the generated PDD repeats it in the step details. Without a chosen Scenario the simulator walks every step in document order, so two mutually exclusive branches are both listed — a "Conditional steps shown in sequence" note says so. When no PDD was supplied the PDD-vs-code gaps are not run (every exception would otherwise be reported as "undocumented"); a "No PDD supplied" note says so. These three notes are informational and do not count toward the toolbar Gaps badge.

**Gap data now travels with its model.** Switching the Process dropdown between two already-imported projects (or back to a built-in sample) correctly refreshes the Gaps button and report to match whichever model is now selected — previously this state lived separately from the model and would show stale data from an earlier import until the same one was re-selected.

**Picking files from different folders one at a time no longer loses them.** The plain "click to browse" / drop-files picker (as opposed to the folder button) gives the browser no folder information at all, so combining files from two different folders means opening that picker twice. If the second folder happened to share a filename with the first — every UiPath project has its own `Main.xaml` and `project.json` — the app used to treat the second file as a duplicate of the first and silently drop it. Nothing is dropped now: files are only treated as a genuine re-pick when name, size, *and* last-modified time all match. Since the browser still can't actually tell two same-named files from different folders apart, every affected file is flagged inline with a warning and pointed at the folder picker instead, which does carry real paths and has no such ambiguity — and if the ambiguity would break automatic multi-project splitting (e.g. two indistinguishable `project.json` files), the app falls back to a single combined import and says so, rather than silently building something wrong.

**Mapping step:** after parsing, workflow calls from REFramework `Process.xaml` or the declared non-REFramework entry workflow are shown in document order with suggested PDD requirements. A text-similarity matcher uses character n-gram Dice coefficient, shared numeric tokens and longest common substring. **The user must confirm every mapping**; unmatched requirements remain review findings. A confirmed association does not establish implementation completeness or runtime reachability.

**Model builder** (`buildProjectModel`) assembles the XAML-derived business spine and nested calls. REFramework projects may also have framework summary and assumed handler steps, with assumptions labelled and optionally hidden; non-REFramework projects omit that framework plumbing. Legacy PDD interventions use the existing human-step model, while newly extracted human-task requirements marked `documentedOnly` are not injected as fabricated executable gates. Step durations are *estimated* from activity count per workflow (`estimateMs`), since XAML contains no measured timing data; these durations are flagged `msAssumed` and shown as estimated.

**The call chain is followed however deep it actually goes, not just one level.** A real project is very often layered (`BusinessLayer` invoking `DataLayer`, which invokes another `DataLayer` file, or a framework root like `InitAllApplications.xaml` invoking real business logic of its own before the main loop even starts) — and only surfacing what `Process.xaml` invokes *directly* left everything past that invisible, despite it being fully parsed already. `expandInvokes()` recursively follows every real `InvokeWorkflowFile` chain (cycle-safe — a workflow already on the current path is never re-entered, though the same file invoked from two different call sites is still expanded at each site) and turns each level into its own step, inheriting its parent's PDD-section mapping rather than getting its own (a PDD would not separately document a DataLayer helper). In the diagram these render genuinely indented — each level's left edge steps in while its right edge stays fixed, so the column narrows rather than drifting into the exception column's space (capped at a sane minimum width past 8 levels; the exact chain is always in the inspector's XAML-source line, e.g. `InitAllApplications.xaml → Read and prepare data → Process sheet row → Parse data robust`) — plus a single "↳" nod on the title and a slightly receded fill so they read as detail rather than a peer of the main steps. Nested steps found under a framework root are tagged `fw:true` like the framework step itself, so they fold into the same Framework-steps collapse/toggle already described below; nested steps found under the business spine are always shown, since they're genuine business logic. The same "referenced but not supplied" / "coded workflow" gap checks apply at every depth, not just the first.

**Main.xaml's own direct invokes are read too, not just Process.xaml and the named framework files.** A classic REFramework end-of-run block — build a run summary, email it — very often lives directly in `Main.xaml` itself, outside both roots the parser otherwise looks at. Anything `Main.xaml` invokes that isn't `Process.xaml` and isn't one of the recognized framework filenames (`FW_NAMES`) is walked and expanded the same way, and shown at the top level — not marked `fw:true`, since this is real reporting/notification behavior worth seeing, not plumbing to collapse away. Shown once per occurrence in `Main.xaml`'s own document order, same as anywhere else a workflow invoked twice becomes two steps.

**The map keeps source evidence separate from PDD requirements.** A business step's source name and detail come from XAML display names, annotations or supported settings; an optional AI label retains its original. A confirmed PDD mapping does not overwrite that evidence. Each imported project's own `project.json` name/description (or workflow class fallback) takes precedence over the PDD title. Parsed PDD requirements feed the gap report, a separate "According to the PDD" inspector block, saved sessions and bounded local-AI prompts. None of these associations proves that a documented action has been implemented.

**The generated draft PDD is a shareable document, not a text dump.** ✦ Generate PDD builds one intermediate document (title, note, headings, key/value and data tables, bullet lists) and renders it four ways: a formatted preview in the app (white "page", real tables, shaded decision rows, indented steps), **Export .docx** (a Word file written by the app itself — a ZIP of OOXML parts with real Heading styles, a repeating table header, fixed column widths and A4 portrait; no library), **Export .html** (standalone page with print CSS), **Print / PDF** (prints that page from a hidden frame, so only the document is printed; use the browser's "Save as PDF"), plus the earlier .md and .json. The document: 1 Document control (process, description, status, version, date, source, trigger, applications, prepared/reviewed/approved ☐), 2 Overview, 3 Process steps (numbered 1, 1.1, 1.1.1 by nesting; Performed by = Robot / Person / System; decisions as shaded rows with "Condition … Yes → … No → …"; the tool's working text — "Invoked from X", "No matching PDD section was confirmed", the full guard-clause chain — is stripped and replaced by "Only when: …" built from the routing decisions), 4 Exceptions (one table: type, where, what happens), 5 Open questions for the business (topic / question / blank answer ☐ — **written from the project, not a fixed list**: a rule fires only when the model holds the fact it asks about and quotes it — the Excel file or other file the robot uses, the web site or application it works in, each decision it takes (as written in the code), each exception that stops the run and where, e-mail it sends, a message box it shows, the Orchestrator queue or asset it reads, the fields it types or reads (asked as possibly personal data), the loops (volume), workflows the code calls that were not supplied, and the framework's Config.xlsx; error handling is asked differently when the code catches nothing; *Business case* and *Scope* always close the list because no code can answer them. With the local model on, up to four further questions it suggests are added, starred ✦ and de-duplicated by topic; with it off or failing, the rule-based questions stand alone), 6 Suggested test scenarios (one per decision path from the Scenario selector plus one per exception, expected result ☐), 7 Known limitations. A .docx made by the app also re-imports as a PDD (its headings use the standard Heading styles). Not verified in Microsoft Word itself — checked by re-reading with the app's own unzip, an XML parser, python-docx and Calibre.

**A draft PDD can also start from code alone.** **✦ Generate PDD** uses the same parsed model as the diagram and report: steps, recognised exceptions, applications and any user-supplied trigger. Rule-based document generation works without an LLM; an optional local model contributes draft overview text and questions. Unsupported or unavailable business context is left for human input, not treated as established by code. The document inherits parser and model limitations and must be reviewed. Exports include **.docx**, **.html**, **.md**, **.json**, and browser **Print / PDF**. The JSON uses the schema accepted by the app's PDD importer, allowing a corrected draft to be imported later.

**A UiPath App (`.uiapp`) is parsed too, when one is supplied.** Not a XAML/PDD source, but a companion artifact worth reading: the file is a URL-encoded header followed by a `[PACKAGESTART]` marker and one large JSON payload, whose `models` array mixes screens (`type:"form"`), a linked Orchestrator process, and a linked queue, told apart only by a `type` field. The process entry's `instances` are exact Orchestrator process names — a verifiable fact, not a fuzzy guess — so `buildProjectModel` checks whether the *current* project's own name appears among them. A match is trusted outright (unlike the text-similarity matching used everywhere else in this file) and auto-fills the ⚡ Trigger field with `Manual — UiPath Apps ('<App title>')`, but only when nothing more specific — a PDD's own documented trigger — has already answered it; the PDD still wins when both exist. The match, plus the App's screen count, is also recorded on the model (`meta.uiApp`) for later use. Screens themselves are counted but not modeled as steps: a UiPath App's own control tree is a separate, much larger parsing problem than a trigger reference, and the one real example inspected so far is a status-monitoring dashboard, not business data entry worth walking through.

### 3.4 Gap report (PDD ↔ XAML)

Available once a project is imported (**Gaps** button, badge shows count). Reports, each with a plain-language "why this matters" note:

1. **Exception coverage matrix** — every exception thrown in code next to its closest documented counterpart (and vice versa), each with a similarity score bucketed into *likely / possible / none*. Deliberately presented as evidence, not a verdict — in the reference project a true pairing scored 6% while a false one scored 32%, so blind thresholding would mislead. An **"✦ Suggest pairings"** button sends both lists to the local LLM for a semantic second opinion — and its suggestions are directly actionable: each recognised "A1 <-> B2" pairing in the model's answer gets its own **✓ Apply** button that confirms both sides at once, without needing to go find the same two rows in the tables below by hand. This matters most exactly where the deterministic scorer is weakest — real paraphrases the LLM understands semantically but that share almost no character n-grams, which the dice-based score alone reports as "no match 0%". Each row also carries a **✓ / ✗ decision affordance**: confirm a pairing once you've read the evidence and it's shown as a resolved "confirmed match" from then on regardless of its original score, or reject it and it's shown as "not the same" — reviewed, not suppressed, so the underlying gap entry stays exactly where it was. Decisions live on the model itself (`model.coverageDecisions`), so they survive reopening the report and a full Save session / Load session round-trip with no extra steps, and the Markdown export reflects them too. **Confirming a pairing also resolves the matching entry in the gap lists below** (`Exceptions thrown in code but not documented`, etc.) — a confirmed exception is no longer an open gap, so it drops out of that count and list; a whole section hides itself once every gap in it is confirmed. Rejecting one deliberately does *not* remove it from the gap list — a rejection is a finding, not a dismissal.
2. **PDD requirements without confirmed mappings** / **workflows with no section** — review findings derived from the mapping, not proof of missing implementation.
3. **Order differences** — where the PDD's step order and the imported XAML's document order disagree. The simulation follows its XAML-derived model, not an evaluated runtime execution trace.
4. **Referenced-but-not-supplied workflows** and **non-XAML (coded) components** — the hard limits of what the parser can see.

The whole report exports to Markdown for a review pack.

### 3.5 Local LLM integration (LM Studio)

An OpenAI-compatible client intended for a **user-run, local** LM Studio server. The URL is configurable, so the user controls where AI requests go; remote endpoints require their own data-handling review.

- **Connection**: Base URL normalized automatically (adds `/v1`, tries LM Studio's native `/api/v0` as a fallback, rewrites the field to whatever endpoint actually answered). Optional bearer-token auth field, with a "remember in browser" toggle (unticked = memory-only for the session, never touches `localStorage`); `401`/`403` responses are reported distinctly as credential problems rather than a generic connection failure.
- **✦ Explain** (in the step inspector): explains the selected step, what breaks if it's missing, and one documentation check for a BA. When the step contains an `Invoke Code` activity, its actual VB/C# is sent along too (capped per block so an unusually long snippet can't exceed a local model's context window, with the cap flagged rather than silently applied), and the prompt asks specifically for a plain-business-language account of what that code reads, changes or decides — concrete enough to check against what the PDD says the step should do, not just confirmation that code exists. Once answered, an "Export .md" button appears next to the answer to save it (step name, process, audience, and the explanation text) as a standalone Markdown file.
- **✦ Brief me** (above the timeline): a pre-run summary of what the robot achieves, where humans remain, and which armed/known exception most threatens the business case. Also exportable to Markdown once answered, the same way.
- **❓ Ask** (above the timeline): a free-form question box for anything else about the currently-loaded process — answered from that process's own steps, exceptions and PDD mapping only, with an explicit instruction to say so rather than guess when the answer isn't in that material. Phase 1 is deliberately stateless: every question gets the process context fresh, with no memory of earlier questions in the same session, reusing the same context-building logic (`processContext()`) as Brief me so both describe the process identically. A real multi-turn conversation is a natural phase 2, once this simpler version's limits (mainly: no follow-up questions building on a prior answer) turn out to actually matter in practice — it needs its own token-budget strategy first, since a real project's own context can already be sizable before any conversation history is piled on top for a small local model's context window.
- **✦ Suggest pairings** (in the gap report): semantic matching between coded and documented exceptions, output as explicit pairing lines plus orphan lists on each side.
- **Audience setting**: the same step or briefing is phrased differently for a new BA trainee, an experienced BA, a business stakeholder, or an RPA developer reviewing the design — selectable in the LLM settings modal.
- **Response language**: a real PDD/XAML is as often written in Romanian as English, and a model answering in the wrong one reads as if it didn't understand the material. Default ("auto") just instructs the model to reply in whatever language the step names, PDD text and log lines it was actually given are written in, rather than having the app try to detect a project's language itself — most local instruct models handle this reliably on request. An explicit "Always English"/"Always Romanian" override is available in the same settings modal for when a model's output in one language turns out weaker than the other.
- **✦ Plain names** (Project toolbar, imported projects): for every step whose label was not typed by the author, and every inferred decision, the model rewrites the label from what the app already holds about it — annotation, activity names, log messages, the arguments by which a repeated call differs, the condition it runs under — in batches of eight, in the process's own language. A step becomes a short verb phrase, a decision a short yes/no question; no file names or identifiers. Originals are kept (`plainOrig`) next to the rewrite (`plain`), the **Plain names (AI)** checkbox flips between them, and Save/Load session keeps both. Two calls to one workflow can never end up with the same label. Needs the LLM; with it off the button only says so. Mock-tested; not yet run against a live LM Studio.
- **Max output tokens** (LLM settings, default 2048): the longest answer a call may produce. When the server reports it stopped because of this limit, the answer ends with a visible "cut off" line instead of silently stopping mid-sentence.
- Every call degrades gracefully to an inline error message (LLM off, unreachable, empty model list, bad credentials) rather than breaking the surrounding UI.

**Live-demo verification.** Brief me, Explain and Ask were exercised on the synthetic imported project with `gemma-3-12b-it` through a local LM Studio server for the v0.61 walkthrough. The captured answers are genuine but not uniformly correct: an explanation can infer a full comparison from an activity label while the WIP implementation only checks supplied evidence. The video explicitly shows this source-check distinction. This does not extend the live-test claim to Plain names, exception pairing, every model or every endpoint.

### 3.6 Process trigger

A **⚡ Trigger** button in the toolbar lets the user record how the currently-loaded process actually starts — e.g. "Scheduled (Orchestrator)", "Orchestrator queue (new item)", "Manual — Orchestrator", "Manual — UiPath Apps", "Attended — user-initiated", or free text of their own (a `<datalist>` offers those as presets without restricting the field to them). This exists because a XAML export carries no trace of how it was started — that fact only ever lives in a person's head or a line in the PDD — so it is deliberately never inferred, only either seeded from the PDD's own trigger field when one was supplied (`meta.ops.trigger`, already parsed from `ops_tip_declansare` in a JSON PDD) or set/corrected manually when there isn't one. The button doubles as the display: it shows the generic label when unset and the actual value once one exists, is stored directly on the model's `meta.ops.trigger` (so it round-trips through Export/Import for free, and travels with a switch between the Process dropdown's entries — each model keeps its own), and works identically for a built-in sample or a freshly imported project.

This was added specifically for XAML-only imports with no PDD (the common case for a fresh multi-project solution) — knowing the trigger is "Manual — UiPath Apps" rather than a scheduled unattended run is real information the tool otherwise has no way to capture or show a stakeholder.

### 3.7 Embedded User Guide

The English/Romanian guide is organised into eight topic tabs: Start here, Import & gaps, Diagram, Human steps, Exceptions, Local AI, Model format and Training. Only the selected topic is shown; the heading and tab bar stay visible while that topic scrolls. The "Coming next" roadmap has been removed. Tabs expose accessible tab/panel relationships and support Left/Right (wrapping), Home and End. The selected topic is preserved when switching language or returning from the simulator. Guide keyboard input does not trigger simulator playback, stepping or reset. Content includes onboarding, diagram legend, human-gate behavior, exception semantics, LM Studio setup, the Process Model format and training exercises. The Romanian guide now also includes the model-format reference.

---

### 3.8 Readable scenario routes

Dropdown titles use a route's activity focus rather than concatenating raw VB expressions. Branch details explain supported negation, Boolean AND/OR and equality (including String.Equals) without an LLM. Each statement retains the complete decoded source expression, source workflow, author-supplied label and required True/Then or False/Else outcome. Authored questions and AI labels are not trusted to determine polarity: a false branch of Not sourceUsable means the source is usable, even if the activity's display name asks the opposite question. String literal values are preserved, including spaces and comparison modes in the expanded source. These are selected walkthrough assumptions, not evaluated runtime values or proof of feasibility.

Unsupported expressions remain technical and require source review. Conditions already truncated in older sessions cannot be recovered from their labels; re-import the original project. Newly imported sessions retain full conditions separately from compact diagram text. Toggling AI labels preserves the selected branch assignment. Timeline exports include selected branch assumptions and original source conditions. When path combinations exceed the selector's cap, entries explicitly describe only one decision and leave all other decisions unselected.

## 4. Known limitations (as documented in-app)

- **Durations are estimates, not measurements.** XAML records no timing whatsoever; the bot/human time split should be read as a *shape* of the process, not a measured benchmark, until real Orchestrator run data is imported.
- **Imported human waits and persistence are not fully modelled.** Documented human tasks remain requirements rather than invented execution gates. A BOT label or zero human-wait total is not evidence that a human-only application boundary or persistent approval has been automated.
- **AI explanations are suggestions, not implementation evidence.** The bounded supplied context may omit relevant source detail, and the model may overstate functionality. Verify claims against original workflows and the PDD, especially for incomplete projects.
- **Fuzzy matching is a suggestion engine, not an authority.** Both the section-mapping matcher and the exception-coverage matcher can and do produce wrong high scores and wrong low scores on real bilingual data; every mapping requires explicit human confirmation, and the coverage table is presented as banded evidence, never as a pass/fail verdict.
- **Coded workflows (`.cs`) are opaque.** Their logic, and any exceptions they throw, cannot be parsed structurally and are always reported as a gap.
- **Referenced-but-missing files** are visible as a gap category but obviously cannot be simulated.

- **Branches are followed one scenario at a time, drawn in one column.** The map is still a single column (skipped steps are dimmed, not drawn as parallel lanes), and the default view lists every branch in order. Only `If` is inferred: `Switch`, `FlowDecision` (one non-framework workflow in the sample projects) and `While` loops are not, and a loop body is still just "repeat: …" text.
- **Exceptions are collected one level deep.** Throws are read from the entry workflow and from the workflows it (or `Process.xaml`) invokes directly, not from deeper layers; widening that needs a filter for the many "Incoming Argument … is Null" validation throws first.
- **No persistence of manual edits.** There is no in-app model editor yet — corrections to an imported model must be made by hand-editing the exported JSON and re-importing it.

---

## 5. Where the product is going

- **What already shipped:** [CHANGELOG.md](CHANGELOG.md).
- **Possible future work:** a model editor, richer test scenarios, measured timings, model comparisons, automated regression coverage, multi-turn questions, and accessibility improvements. These are ideas rather than release commitments.

---

## 6. Technical notes for maintainers

- **Single-file architecture**: everything (CSS, HTML, JS) lives in one `.html` file, organized into 14 numbered sections (see in-file comments): utilities → process model/samples → state → run-plan builder → diagram → timeline → playback engine → inspector → LM Studio client → model loading/UI wiring → parsers → model builder → import UI → gap report → i18n.
- **No framework, no build step, no dependencies.** DOM APIs and native browser features (`DOMParser`, `DecompressionStream`) do all the heavy lifting (XML parsing, ZIP/DOCX inflation).
- **The model builder is a pipeline of named stages.** `buildProjectModel` (§11) is ~20 lines that call, in a fixed order, `detectProject → addHumanSteps → addFrameworkOpening → addSpineSteps → addInlineProcessSteps → addFrameworkStatus → addEntrySteps → addInlineMainSteps → addFrameworkClose → noteStepSources → markRepeatedCalls → inferGateways → addFlowNotes → collectThrownExceptions → addPddGaps → exceptionCoverage → buildMeta`. Each stage takes one context object `c` and appends to the shared `c.steps / c.exceptions / c.gaps`; the comment above the first stage lists what each does. The **order matters** (step order, gap order and every id depend on it) — add a stage in the right place and run the tests; do not reorder without a reason.
- **Strict separation of concerns**: parsers (§10) never touch the DOM or global state; they emit plain data fragments. The model builder (§11) is the only place that turns those fragments into the canonical Process Model + gap list. Everything downstream (diagram, timeline, LLM prompts) reads only the Process Model, never the raw parsed sources — this is what makes samples and imported projects behave identically everywhere else in the app.
- **Saved sessions are versioned.** `SCHEMA_VERSION` + `MIGRATIONS` (near the model-loading code) define the file format; change the shape of the model only together with a migration step and a version bump.
- **Validation:** `node --test tests/*.test.cjs` runs the dependency-free Node suite. GitHub Actions compiles the embedded JavaScript and runs legacy XAML/parser compatibility, canonical PDD/converter contract, full import-pipeline, exception-evidence, scenario, guide-navigation and branding tests. They are not a browser end-to-end suite or a UiPath runtime test. Actual imports, generated documents, exports and layout still require browser checks with anonymised data. See the changelog for the verified test count for each revision.
- **`localStorage` is optional and guarded** (`store` helper) — the app degrades to in-memory settings if storage is blocked, and LLM API tokens are only persisted if the user explicitly opts in.

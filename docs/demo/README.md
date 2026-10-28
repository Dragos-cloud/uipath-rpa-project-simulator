# RPA Project Simulator — video walkthrough

**New short:** [Four perspectives. One shared process. (0:25)](SHORT_V070.md), published with app v0.70. It uses earlier synthetic demo captures. The longer walkthrough below remains the v0.63 recording.

**Approved v0.63 walkthrough:** 3:28, with neutral product branding, current app captures and a shared perspective for business analysts, RPA developers, stakeholders and trainers. The repository and Pages URLs are intentionally unchanged. See the [branding decisions](../BRANDING.md#video-decision).

UiPath™ is a trademark of UiPath, Inc. and UiPath SRL. RPA Project Simulator is an independent community tool, not affiliated with, sponsored by, or endorsed by UiPath. No permission or certification is claimed.

[Open the live app](https://dragos-cloud.github.io/uipath-rpa-project-simulator/) · [Source repository](https://github.com/Dragos-cloud/uipath-rpa-project-simulator)

[Watch or download the MP4 (3:28, 1080p)](https://github.com/Dragos-cloud/uipath-rpa-project-simulator/releases/download/v0.63/rpa-project-simulator-walkthrough-v063.mp4) · [English subtitles](https://github.com/Dragos-cloud/uipath-rpa-project-simulator/releases/download/v0.63/captions.srt) · [Release](https://github.com/Dragos-cloud/uipath-rpa-project-simulator/releases/tag/v0.63)

[![One project, four perspectives](preview-v063.jpg)](https://github.com/Dragos-cloud/uipath-rpa-project-simulator/releases/tag/v0.63)

Bring your own UiPath project into a shared view for business analysts, RPA developers, stakeholders and trainers. The video uses a synthetic Customer Order Processing PDD and intentionally unfinished workflows—not production data. The project is kept incomplete to support a discussion about what still needs work; its source files are not part of this repository.

## Chapters

| Start | What is shown |
| --- | --- |
| 0:00 | One project, four perspectives |
| 0:16 | Import workflows and the optional PDD |
| 0:28 | Review suggested mappings and build the model |
| 0:40 | Scenario selects a route: Recover OMS Evidence |
| 0:51 | Branch assumptions and original source conditions |
| 1:02 | Scenario versus Inject Exception |
| 1:10 | Open Step 8's inspector from the diagram; read the PDD reference |
| 1:26 | Hold on the manual business-day requirement/code comparison |
| 1:42 | Gap report and evidence-review limitations |
| 1:52 | Connect a local model and select an audience |
| 2:04 | Brief me: stakeholder introduction |
| 2:15 | Open the OMS card and Explain inside its inspector |
| 2:26 | Check the AI explanation against the actual workflow evidence |
| 2:38 | Ask about human OMS responsibility |
| 2:52 | Step, save a session, exports and a PDD draft |
| 3:02 | Built-in training example: inject a failure and explore recovery |
| 3:17 | Bring your own project; ownership and independence notices |

## What the demonstration does—and does not—establish

- Screens show actual app captures and actual `gemma-3-12b-it` responses through a locally configured LM Studio endpoint. The walkthrough is an edited sequence of narrated screen captures, not execution of the imported UiPath project.
- The PDD requires one business day; the sample's current clarification workflow uses `DateTime.Now.AddDays(1)`. This is a manually checked review example, not an automatically detected calendar-rule defect.
- The local AI can overstate functionality. In this capture, Explain suggests checking the submission against the approved order, while the WIP code checks evidence fields and the intake reference. The next source-review card explicitly calls out this difference. Ask's role answer also needs checking against the PDD and code.
- Scenario chooses a route through decision assumptions; Inject Exception explores an available failure response. No injectable Throw exception was matched in the imported project, so injection is demonstrated with the invoice training example instead. This is not proof of complete error handling.
- A gap count or absence of matching Throw evidence does not establish a defect total. Mappings and AI answers require human review.
- Durations are estimates. Imported persistence/human-wait semantics are incomplete; a zero human-wait total or BOT label does not establish that manual responsibilities are automated.
- The PDD output is a draft for correction, not approved process documentation.

## Production disclosure

The video has AI-generated narration using ElevenLabs and AI-assisted production, with a persistent on-screen disclosure and embedded English captions. The final narration does not include an author credit; the app's existing footer may be visible. The optional SRT has approximate within-clip speech timing. The release asset is a fast-start H.264/AAC MP4, 1920×1080 at 24 fps, 48 kHz mono audio, approximately 10.1 MB. It runs for 207.9 seconds (3:28 rounded).

Numbered gold control highlights and source-review cards are editorial annotations, not app features. Enlarged panels are labelled as the same inspector and retain surrounding app context. Step 8 has a 16-second inspector sequence, including 9.5 seconds on its PDD reference, followed by a 16-second manual source comparison. Pauses between sections give viewers reading time.

The MP4 and subtitles live in the GitHub release to avoid putting large binary production assets in Git history. Previous video cuts, voice files, credentials, raw model responses and private code-review notes are not published.

## Historical v0.61

The former 2:46 recording is preserved unchanged with its original branding: [MP4](https://github.com/Dragos-cloud/uipath-rpa-project-simulator/releases/download/v0.61/uipath-rpa-project-simulator-demo.mp4), [subtitles](https://github.com/Dragos-cloud/uipath-rpa-project-simulator/releases/download/v0.61/captions.srt), [release](https://github.com/Dragos-cloud/uipath-rpa-project-simulator/releases/tag/v0.61). It is an archive, not the current promotional cut.

See the [matching LinkedIn post draft](LINKEDIN_POST.md). Publishing this repository or release does not post anything to LinkedIn.

Independent community tool developed by Dragos Marin; not affiliated with, sponsored by, or endorsed by UiPath.

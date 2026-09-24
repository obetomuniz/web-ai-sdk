# Playground architecture

This document describes the internal architecture of the Playground at
`/playground/`. It is maintainer documentation for the site application, not
part of the public SDK documentation.

The Playground consumes `web-ai-sdk`. It combines the packages in a local-first
agent application. Orchestration and UI code stay outside the SDK wrappers.

## Goals

- Make persisted conversations appear immediately on reload.
- Keep inference and conversation data in the browser.
- Exercise the SDK packages through realistic, inspectable agent workflows.
- Keep streaming, scrolling, resizing, and panel transitions visually stable.
- Preserve conversation ownership across asynchronous model and tool work.
- Keep the feature understandable enough to extend without growing a single
  page-level component.

## Layer boundaries

| Layer | Responsibility |
| --- | --- |
| SDK packages | Browser API detection, session lifecycle, streaming normalization, cleanup, and WebMCP registration |
| Agent runtime | Planning, tool execution, step limits, streaming, and turn completion |
| Playground application | Conversations, modes, examples, activity, persistence, and responsive workspace behavior |
| Components | Composer, conversation navigation, transcript presentation, runtime metadata, and panel controls |
| Astro boot shell | Immediate read-only rendering of the last persisted conversation before React is interactive |

Use `@web-ai-sdk/*` for browser API lifecycle management. Keep package
composition, mode tools, and conversation persistence in this feature.

## Directory map

| Path | Purpose |
| --- | --- |
| `Playground.tsx` | Composition root that connects conversations, the agent runtime, examples, and WebMCP |
| `PlaygroundFallback.astro` | Synchronously paints persisted state during the React island boot |
| `components/PlaygroundLayout.tsx` | Top-level columns, resize control, and panel restore controls |
| `components/ConversationsPanel.tsx` | Conversation navigation and lifecycle actions |
| `components/ConversationView.tsx` | Active conversation header, track, scroll behavior, and composer |
| `components/ConversationTrack.tsx` | Persisted and live turns projected into the transcript renderer |
| `components/Composer.tsx` | Prompt input, modes, examples, tools, notices, and send or stop actions |
| `components/RuntimePanel.tsx` | Runtime checks, ephemeral Activity, and local-first guidance |
| `lib/agentThreads.ts` | Persistence schema, recovery, sorting, and thread construction |
| `lib/useActivityLog.ts` | Bounded, ephemeral runtime diagnostics |
| `lib/useAgentThreads.ts` | React state and mutation API for conversations |
| `lib/useConversationAgent.ts` | Active model session, run ownership, turn completion, and generated titles |
| `lib/usePlaygroundLayout.ts` | Responsive panel state, sidebar geometry, and resize behavior |
| `lib/usePromptReadiness.ts` | Optimistic Prompt API capability probing and download polling |
| `lib/usePlaygroundWebMCPTools.ts` | WebMCP tools that control the Playground |
| `lib/useStickToBottom.ts` | User-aware transcript following |
| `experimental/agent/` | Agent planning and execution runtime |
| `experimental/playground/` | Modes, tool catalog, low-level renderers, and contextual examples |

## Main components

The primary component tree mirrors the product rather than implementation
details:

```text
Playground
└── PlaygroundLayout
    ├── ConversationsPanel
    ├── ConversationView
    │   ├── ConversationTrack
    │   └── Composer
    └── RuntimePanel
```

`Playground` coordinates shared workflow state. Each child owns one product
region. Named hooks and domain modules contain shared stateful behavior.

## Technical decisions

### 1. The Playground is application code, not a new SDK abstraction

The SDK wrappers remain small and framework-agnostic. The Playground combines
them into an application. Playground-specific behavior is not public SDK API.

### 2. Conversations are local-first

The React state initializer loads conversations from `localStorage`. It writes
after state changes and sorts conversations by `updatedAt`.

Treat persisted data as untrusted input. Discard invalid conversations and
turns individually. One malformed entry must not erase valid conversations.

The persistence schema is shared conceptually by the Astro boot shell and the
React application. A schema change must update both readers and the
`agentThreads` regression tests.

### 3. Show the cached conversation during loading

Do not show a spinner or empty conversation while JavaScript loads.
`PlaygroundFallback.astro` renders the last active conversation from storage.

React replaces the shell in `useLayoutEffect`. The shell is `inert`; it must not
contain business logic or handle input.

The boot and React renderers use different runtime libraries. They must support
the same safe Markdown subset and storage shape. Check visual parity in a build
preview.

### 4. Availability checks are optimistic

Prompt API detection is asynchronous. Treat the initial state as ready. Show a
notice only after the browser reports a known unavailable or download state.

This prevents status changes during page load. A downloadable model keeps the
composer enabled because the first message is the user intent that starts the
download. Poll download states because the browser can update them without a
reload.

### 5. Keep each run with its original conversation

When a message starts, capture its conversation ID, turn ID, and first-turn
state. Append the result to that conversation, even if the selection changes.

Block conversation changes and WebMCP mutations while a response runs. This
prevents output from reaching the wrong conversation or model session.

### 6. Modes configure behavior without deleting history

A mode bundles a system prompt, tools, starter examples, and renderers. Changing
the mode keeps the existing conversation turns but starts a fresh model session
with the new configuration.

The mode selector is hidden only by normal responsive constraints, not by
conversation age. This keeps mode changes possible while preserving the
conversation flow the user already sees.

### 7. Conversation titles are generated after the first completed reply

The browser Summarizer creates a short title from the first user request and
assistant response. The request text is used as the fallback only when the
Summarizer is unavailable or fails.

The UI keeps `New conversation` until one final title is available. It does not
briefly render a truncated request before replacing it with the summarized
title, which avoids a visible title flicker.

### 8. Markdown uses one stable React pipeline

Streaming and completed assistant messages both pass through the same
`MessageContent` component. `remend` completes partial Markdown constructs
before `react-markdown` and `remark-gfm` render them.

Using one pipeline avoids replacing plain streaming text with a different
Markdown tree when the response completes. Syntax-only stream tails are held
back until they contain semantic content, preventing temporary `**`, list
markers, or thematic rules from blinking on screen.

### 9. Transcript following respects user intent

The transcript starts pinned to the latest content. Selecting a conversation or
sending a message moves to the bottom before paint. During streaming, one
`requestAnimationFrame` loop follows the changing scroll height instead of
restarting native smooth scrolling for every chunk.

Scrolling upward disables following immediately. It resumes when the user
returns near the bottom or activates the latest-message control. Reduced-motion
preferences use immediate scrolling.

### 10. Show curated examples first

Every mode includes curated examples. Generate new examples only when the user
requests them. Use recent turns as context for that request.

Cancel generation when the mode, conversation, or active run changes. Reject
placeholder resources such as root GitHub URLs or `example.com`. Use contextual
fallbacks when generation fails.

### 11. Responsive panels slide instead of compressing content

Desktop uses three conceptual columns. The conversation column is resizable
through CSS custom properties, and pointer movement previews the width directly
on the shell so React does not rerender on every pixel.

At narrower widths, the runtime panel becomes an overlay rather than shrinking
the transcript. Opening and closing panels uses transform and opacity
transitions. Transitions are disabled during direct sidebar resizing to avoid
spring-like or delayed feedback.

The panel restore controls belong to the outer layout rails. They must not share
the title's content row or reduce the title's available width.

### 12. Activity is ephemeral diagnostics

Conversations and turns persist across reloads. Runtime Activity does not. It
describes events from the current page session and is intentionally capped at
50 entries.

Activity shows Prompt, conversation-title Summarizer, WebMCP discovery, and the
selected mode's text capabilities. API exposure alone does not mean readiness.
Task-dependent options stay unknown until a tool invocation supplies them.
Readiness, download progress, and named tool outcomes appear beside run events.

The Activity count is therefore not expected to equal persisted turn, tool, or
agent-step counts. It is a lightweight inspection surface, not an audit log.

### 13. WebMCP exposes the application through a stable tool boundary

Playground WebMCP tools list and mutate the same conversation state used by the
UI. The pure `createPlaygroundWebMCPTools` factory is separate from the React
registration hook so behavior can be tested without mounting a browser UI.

Read operations remain available while a response is running. Mutations return
an explicit busy result instead of racing the active run.

### 14. The composer is a compact inline surface

The composer places the mode trigger, prompt input, tool summary, and send or
stop action in one row, styled as a single rounded surface. Example
suggestions float above the surface and never narrow the prompt input.

The floating example list renders only while the prompt is available, idle,
and empty. The list container uses one background gradient into the page
color, so transcript content fades out behind the suggestions.

The input starts at one line. It grows with wrapped or multiline text through
`field-sizing: content`, up to a capped height, then scrolls internally. The
primary controls stay anchored to the bottom of the row while the input grows.

The row composition comes from named grid areas in `ui.composer`. Below 640px
the input takes its own full-width row, the mode trigger and actions move to a
compact second row, and examples stay hidden. The Astro boot shell mirrors the
same structure and classes.

## SDK capability coverage

| Package | Playground role | Deliberate limits |
| --- | --- | --- |
| Prompt | Plans tools, streams replies, clones sessions, budgets context, and generates requested examples | Text only; conversation sessions remain application-owned |
| Summarizer | Summarizes supplied source text and generates conversation titles | Source-provenance checks remain; title failures use the request text |
| Translator | Translates with an explicit source and target language | Readiness uses the actual pair; no assumed default pair |
| Detector | Returns ranked language candidates and confidence | Does not choose translation policy inside the SDK |
| Writer | `write_text` drafts from a task, tone, length, and optional context | Uses cumulative updates; does not replace conversation text |
| Rewriter | `rewrite_text` revises supplied text with relative tone and length | Keeps original input immutable |
| Proofreader | `proofread_text` returns corrected text and correction metadata | Displays original offsets, replacement, type, and explanation; never applies edits automatically |
| WebMCP | Registers conversation controls and reports native discovery | Internal planner calls application callbacks, not native discovered tools |

Built-in Web AI suite requires a successful tool result before showing an answer.
A prose answer gets one corrective turn toward the matching tool, and translation
requests need a Translator result. Otherwise the model's own answer is withheld.
Unavailable tools, invalid arguments, operational failures, and cancellation remain
distinct. The suite stops on tool failure. Kitchen sink asks the model to identify
the SDK capability it used. Minimal remains available for ordinary Prompt-only
requests.

On-device planners misspell optional hints. Tools map near misses such as
`formal` to the Rewriter's `more-formal`, drop unknown optional values and extra
fields, and accept one language as a string. Missing or empty text still fails
as invalid input.

Each text operation probes its exact options, then prepares a matching SDK
session owned by the conversation agent. Later calls with the same options reuse
it. The agent keeps at most four and releases them when the mode or conversation
changes or the Playground unmounts. No text models are created at page load.
The application does not clear global SDK caches or enable new result persistence.

Browsers start model downloads only from a user gesture, and a planned tool call
runs seconds after Send. When a failed call's model is downloadable, its tool
card offers **Download model**. Readiness is checked live, so persisted cards stay
accurate. After the download, the next request runs without a gesture.
Activity reports download progress only when a download was needed; Chrome
also fires progress events when creating sessions for installed models.

WebMCP `send_message` forwards native cancellation to its own conversation run.
The abort listener is removed when that invocation ends. Deletion keeps the
compatibility destructive hint and adds the consequential annotation.
Discovery loading and errors remain visible separately from API exposure.
Discovered schemas may be objects, strings, or absent.

## Maintenance invariants

- Do not add browser API lifecycle code when an SDK package already owns it.
- Do not make the Astro boot shell interactive.
- Keep boot and React persistence readers compatible.
- Keep streaming and completed React messages on the same Markdown pipeline.
- Capture conversation ownership before starting asynchronous work.
- Do not switch, delete, or reconfigure a conversation during an active run.
- Show curated examples immediately. Never generate them just to fill first
  paint.
- Update CSS variables directly while dragging. Commit React state when the
  gesture ends.
- Respect `prefers-reduced-motion` for non-essential movement.
- Add focused tests when changing persistence recovery, WebMCP mutations,
  resource inference, or generated-example validation.

## Validation

Run the full repository gate before committing:

```sh
pnpm gate
```

For rendering changes, also validate the built site rather than relying only on
the development server:

```sh
pnpm build
pnpm --filter @web-ai-sdk-apps/site exec astro preview --port 4173
```

Use a supported browser for final Playground QA. Verify at minimum:

- persisted reload without an empty-state flash;
- desktop, intermediate, and mobile layouts;
- long transcripts and user-controlled scrolling;
- panel resizing and overlay transitions;
- mode and conversation changes around active runs;
- Markdown lists, code, links, and partial streaming syntax;
- console warnings and errors;
- layout shift during reload.

### Browser smoke harness

Open `/playground/smoke/` in the production preview. Each button invokes a real
SDK operation after explicit user intent. Record the exact browser version,
enabled flags, trial-token setup, results, and skips from the JSON report.
Use [Browser support](/docs/browser-support/) for current setup instructions.

WebMCP checks register uniquely named temporary tools and use SDK `executeTool`.
The deletion check uses an isolated in-memory conversation, never persisted user
conversations. The cancellation check verifies one invocation and a native
callback abort. Cleanup unregisters each smoke tool.

Run on both object-input and legacy string-input hosts when available. Do not
simulate another generation by overriding native execution in browser QA.
Unit tests cover both SDK execution generations separately.

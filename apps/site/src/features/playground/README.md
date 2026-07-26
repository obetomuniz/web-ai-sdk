# Playground architecture

This document describes the internal architecture of the Playground at
`/playground/`. It is maintainer documentation for the site application, not
part of the public SDK documentation.

The Playground is a consumer of `web-ai-sdk`. It demonstrates how the SDK
packages can be composed into a local-first agent experience without moving
application orchestration or UI concerns into the framework-agnostic wrappers.

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

The Playground should use `@web-ai-sdk/*` whenever the SDK already owns the
browser API lifecycle. Consumer-specific behavior such as chaining multiple
packages, choosing tools for a mode, or persisting conversations stays in this
feature.

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
| `components/RuntimePanel.tsx` | Capability status, ephemeral Activity, and local-first guidance |
| `lib/agentThreads.ts` | Persistence schema, recovery, sorting, and thread construction |
| `lib/useActivityLog.ts` | Bounded, ephemeral runtime diagnostics |
| `lib/useAgentThreads.ts` | React state and mutation API for conversations |
| `lib/useConversationAgent.ts` | Active model session, run ownership, turn completion, and generated titles |
| `lib/usePlaygroundLayout.ts` | Responsive panel state, sidebar geometry, and resize behavior |
| `lib/usePromptReadiness.ts` | Optimistic Prompt API capability probing and download polling |
| `lib/useWebMCPTools.ts` | WebMCP tools that control the Playground |
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

`Playground` coordinates cross-cutting workflow state. Each child owns one
recognizable product region, while shared stateful behavior lives in a named
hook or domain module. Small visual primitives such as `PanelToggle` remain
implementation details of those primary components.

## Technical decisions

### 1. The Playground is application code, not a new SDK abstraction

The SDK wrappers remain small and framework-agnostic. The Playground is where
multiple wrappers are intentionally composed into a product experience. This
keeps the core packages reusable and prevents a demo-specific agent model from
becoming public API.

### 2. Conversations are local-first

Conversation state is loaded synchronously from `localStorage` in the React
state initializer. Writes happen after state changes, and conversations sort by
`updatedAt` so the most recently active work remains first.

Persisted data is treated as recoverable input rather than trusted application
state. Invalid conversations and turns are discarded individually. One
malformed entry must not erase every valid conversation.

The persistence schema is shared conceptually by the Astro boot shell and the
React application. A schema change must update both readers and the
`agentThreads` regression tests.

### 3. The cached conversation is the loading state

The page does not display a spinner or an empty conversation while JavaScript
boots. `PlaygroundFallback.astro` reads the same browser storage synchronously
and renders a read-only representation of the last active conversation.

React replaces that shell in `useLayoutEffect`, before the browser paints an
intermediate interactive state. The boot shell is `inert` and must not acquire
business logic or handle user actions. Its only job is to preserve the first
paint until React owns the page.

The boot renderer and React renderer use different runtime libraries because
the boot shell must execute inline before the island loads. They must continue
to support the same safe Markdown subset and storage shape. Visual parity is
covered through build-preview reload QA.

### 4. Availability checks are optimistic

Prompt API probing is asynchronous, but a probe is not evidence that the model
is unavailable. The initial state therefore behaves as ready and only surfaces
a warning after Chrome reports a definitive unavailable, downloadable, or
downloading state.

This prevents the composer and runtime status from flashing between enabled
and disabled during page load. Downloading states are polled because Chrome can
transition without a page reload.

### 5. Every run owns its original conversation

When a message starts, the Playground captures its conversation id, turn id,
and whether it is the first turn. Completion appends and titles the captured
conversation rather than whichever conversation happens to be selected later.

Conversation switching, deletion, mode changes, and WebMCP mutations are
blocked while a response is running. This is an integrity boundary, not merely
a UI choice. Without it, asynchronous completion could write model output into
the wrong conversation or reset the wrong model session.

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

### 10. Examples have an immediate deterministic baseline

Every mode ships curated examples, so the composer never waits for generated
suggestions on first render. Generated examples are requested explicitly or
after a newly completed turn provides useful conversation context.

Generation is cancelled when the mode, conversation, or active run changes.
Outputs are filtered for concrete goals and reject placeholder resources such
as root GitHub URLs or `example.com`. Contextual fallbacks ensure that model
failure does not leave the composer empty or introduce a layout shift.

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

The Activity count is therefore not expected to equal persisted turn, tool, or
agent-step counts. It is a lightweight inspection surface, not an audit log.

### 13. WebMCP exposes the application through a stable tool boundary

Playground WebMCP tools list and mutate the same conversation state used by the
UI. The pure `createPlaygroundWebMCPTools` factory is separate from the React
registration hook so behavior can be tested without mounting a browser UI.

Read operations remain available while a response is running. Mutations return
an explicit busy result instead of racing the active run.

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

Use Chrome for final Playground QA because the on-device APIs are exposed
there. Verify at minimum:

- persisted reload without an empty-state flash;
- desktop, intermediate, and mobile layouts;
- long transcripts and user-controlled scrolling;
- panel resizing and overlay transitions;
- mode and conversation changes around active runs;
- Markdown lists, code, links, and partial streaming syntax;
- console warnings and errors;
- layout shift during reload.

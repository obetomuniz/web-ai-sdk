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
warning only after the browser reports a known unavailable or download state.

This prevents status changes during page load. Poll download states because the
browser can update them without a reload.

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

The Activity surface begins with live checks for Prompt, Summarizer, and WebMCP
support. Keeping capability state in the same diagnostic list avoids decorative
status chrome and makes unavailable or downloading states inspectable beside
the events they affect.

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

Use a supported browser for final Playground QA. Verify at minimum:

- persisted reload without an empty-state flash;
- desktop, intermediate, and mobile layouts;
- long transcripts and user-controlled scrolling;
- panel resizing and overlay transitions;
- mode and conversation changes around active runs;
- Markdown lists, code, links, and partial streaming syntax;
- console warnings and errors;
- layout shift during reload.

# Playground browser validation

Tested on 2026-09-13 in the `sticky-newt` workspace, based on `97f8629` plus the accompanying implementation.
These observations do not change package stages or browser support claims.
Use the [canonical setup guidance](../../content/docs/browser-support.mdx).

## Setup

Built with `pnpm build` and served with `pnpm preview:site` at `http://localhost:34192`.
Checks used real SDK exports on `/playground/smoke/` and an isolated Playground conversation store.
The smoke harness creates and deletes only an in-memory conversation.

| Browser | Exact installed build | Setup | Result |
| --- | --- | --- | --- |
| Chrome | 153.0.8010.37 | Existing browser, isolated test contexts; flags below | All seven text capability checks and WebMCP passed |
| Chrome Canary | 155.0.8053.0 | Separate temporary profile; flags below | Prompt, Writer, Rewriter, Summarizer, Detector, and WebMCP passed; readiness skips described below |
| Safari | 26.5.2 (21624.2.5.11.8) | WebDriver session health check | Skipped: Safari requires “Allow remote automation”; no settings changed |
| Edge | Not installed | No executable available | Skipped |

Chrome's relevant enabled experiments were `enable-webmcp-testing@1`, `devtools-webmcp-support@1`, `writer-api@1`, `rewriter-api@1`, `proofreader-api@1`, and `summarizer-api-performance-preference@1`.
Canary's temporary profile enabled `enable-webmcp-testing@1`, `writer-api@1`, `rewriter-api@1`, and `proofreader-api@1`.
These are flag-based observations. No origin-trial token was installed or tested.
Both browser builds exposed all seven text API globals. Exposure alone did not determine readiness.
Canary reported `downloadable` for the English-to-Portuguese translation pair, so that operation was skipped before model creation.
Proofreader passed initially but reported `downloadable` on the final rerun. Both Canary reports are retained.

## Native results

See [Chrome 153 results](./browser-smoke-chrome153.json) and [Canary 155 results](./browser-smoke-chrome155.json).
The saved reports omit intermediate cumulative output buffers; they retain operation results and lifecycle progress.

Both Prompt runs received `40 + 4`, followed by `dont add the calculation, just result, ok?`.
Both returned native follow-up chunks `["4", "4"]`. The SDK preserved the answer `44`.
This reproduces the stream shape that the former prefix heuristic reduced to `4`.

Proofreader returned `I saw him yesterday.` with replacement `saw` at offsets 2–6.
These hosts omitted optional correction type and explanation. Unit tests separately retain those optional fields.
Writer and Rewriter produced cumulative updates. Translator returned `Olá mundo` on Chrome 153.
Detector retained ranked Portuguese and `und` candidates with confidence values.

| WebMCP check | Chrome 153 | Canary 155 |
| --- | --- | --- |
| Native execution generation | Positional, function arity 2 | Object input, function arity 1 |
| Discovery | 7 tools | 7 tools |
| `list_conversations` callback count | 1 | 1 |
| `send_message` callback count | 1 | 1 |
| Native callback signal | Present | Present |
| Cancellation result | `AbortError` | `AbortError` |
| Isolated `delete_conversation` callback count | 1 | 1 |
| Configured `consequentialHint` | `true` | `true` |
| Discovered `consequentialHint` | Omitted by host | `true` |

An initial Chrome 153 harness run failed because it required discovery to preserve the consequential annotation.
The corrected harness checks the configured annotation and records host discovery metadata separately.
Registration is asynchronous, so the harness waits for its owned tool names before invoking them.
Each check has a 45-second deadline. The final harness rerun passed all checks on Chrome 153.
Canary again passed object-input execution and cancellation checks, with the two readiness skips described above.

## Preview interaction

A real Built-in Web AI suite request invoked `proofread_text` and displayed corrected text alongside the unchanged source and offsets.
The conversation survived a preview reload. Expanding the result showed the native replacement without applying it to source text.
At 390×844, the conversation, composer, and runtime panel fit without horizontal overflow.
At 1440×900, the conversation panel, result, three curated examples, and composer remained visible and aligned.
The result disclosure responded to Enter. Enter in the composer started a response.
Conversation and mode controls were disabled while a response was active.
Stopping that response allowed switching to the preserved proofreading conversation without projecting the cancelled response there.

Automated tests cover malformed result rendering, unsafe text, invalid offsets, mode/unmount cleanup, and late-result isolation.
They also cover same-tick WebMCP mutations before React commits busy state.

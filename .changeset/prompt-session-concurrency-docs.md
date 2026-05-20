---
"@web-ai-sdk/prompt": patch
---

Amends the `createSession()` / `useSession()` docs to match the empirical behavior of Chrome 138 / Edge 138. The 0.3 release notes (and README, JSDoc, and the Prompt API guide on the docs site) leaned on "N parallel chats stream concurrently" or close paraphrases. Token-level interleaving across independent sessions is not actually delivered by the runtime today: the on-device model is single-instance, so the browser drains one `sendStreaming` call fully before starting the next, even across separate `createSession()` instances.

No API change, no behavior change. `createSession()` / `useSession()` still solve the bugs they shipped to solve — isolated history per session, isolated system prompt and sampling, scoped `abort()` and `destroy()` — and the API stays forward-compatible the day a runtime exposes parallel inference. The docs now make the runtime constraint explicit (a new "Concurrency note" in the prompt README and Prompt API guide) and the README / JSDoc copy emphasizes independence-of-state rather than concurrent streaming.

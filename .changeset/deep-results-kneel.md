---
"@web-ai-sdk/prompt": minor
---

Preserve repeated and prefix-shaped Prompt stream chunks by concatenating native deltas. The wrapper no longer guesses cumulative snapshots. Versioned default result-cache keys ignore entries created before this fix; refresh custom keys if they contain affected results.

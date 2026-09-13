---
"@web-ai-sdk/prompt": minor
---

Preserve repeated and prefix-shaped Prompt stream chunks. Native streams now default to delta mode, so two chunks containing 4 produce 44. Legacy snapshot hosts must set streamMode to cumulative on ask(), createSession(), or useSession(). Clones inherit the mode, and result cache keys distinguish cumulative compatibility.

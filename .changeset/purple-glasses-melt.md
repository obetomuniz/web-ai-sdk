---
"@web-ai-sdk/prompt": patch
---

Keep `RegExp` response constraints distinct in the `ask()` result cache. The default cache key now encodes a `RegExp` by its `source` and `flags`, so different patterns or flags no longer share an entry. A `RegExp` and a JSON Schema never share an entry, and existing JSON Schema keys stay the same. Constraints that JSON cannot represent losslessly, such as class instances or circular objects, now skip the default result cache. Pass a custom `cacheKey` to cache them. These constraints also no longer make `ask()` throw a `TypeError` before the browser call. The SDK still forwards every constraint to the browser unchanged.

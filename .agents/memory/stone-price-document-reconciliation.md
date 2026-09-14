---
name: Stone price document reconciliation
description: Decision rule for reconciling the sheet-price and installed-price stone catalogs.
---

When the two price documents spell the same stone differently, keep one canonical item with the source spelling as a searchable alias only after the visual/name match is clear. Keep different product codes as separate items, even when their names are similar. If one document does not list an exact code, show the missing price as unavailable instead of inferring it from a price band.

**Why:** The documents contain real code variants alongside ordinary spelling/OCR differences. Merging every near-match risks quoting the wrong material, while silently filling missing prices creates an untraceable quote.

**How to apply:** Use the two source documents as the authority for prices, retain source-code aliases for search, and block quote generation when the selected format has no documented price.
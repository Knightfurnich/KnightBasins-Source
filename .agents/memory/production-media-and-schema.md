---
name: Production media and schema deployment
description: Shared VPS media paths and database permissions needed when adding Knight Basins catalog fields.
---

The public Knight Basins image service stores basin HD photos under `/kb/images/basin-hd/{SKU}.jpg`; older catalog rows may still contain `/kb/images/basins/{SKU}.png` URLs that return 404. Preserve explicit uploaded URLs, but normalize those legacy URLs to the HD source when serializing catalog data.

**Why:** The shared VPS keeps Knight Basins in `knight_basins` on the `knightdesign-db` container, while the app connects as `knight_basins_app`. New tables created by the `knightdesign` database owner do not automatically grant the app role access.

**How to apply:** After adding a production table or sequence, grant the app role the exact required table privileges and sequence usage/select privileges before restarting the API. Verify the admin endpoint with the production session and the public catalog image URLs.
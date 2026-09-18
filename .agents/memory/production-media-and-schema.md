---
name: Production media and schema deployment
description: Shared VPS media paths and database permissions needed when adding Knight Basins catalog fields.
---

The public Knight Basins image service stores basin HD photos under `/kb/images/basin-hd/{SKU}.jpg`; older catalog rows may still contain `/kb/images/basins/{SKU}.png` URLs that return 404. Preserve explicit uploaded URLs, but normalize those legacy URLs to the HD source when serializing catalog data.

**Why:** The shared VPS keeps Knight Basins in `knight_basins` on the `knightdesign-db` container, while the app connects as `knight_basins_app`. New tables created by the `knightdesign` database owner do not automatically grant the app role access.

**How to apply:** After adding a production table or sequence, grant the app role the exact required table privileges and sequence usage/select privileges before restarting the API. Verify the admin endpoint with the production session and the public catalog image URLs.

The authenticated admin catalog endpoints hydrate missing media into absolute public URLs. A data-only Development catalog sync should treat those URLs as display references and should not assume the corresponding VPS upload files exist locally.

**Why:** The Production snapshot can contain uploaded catalog media served by the VPS as well as central slab/basin assets, while Development has a separate upload directory.

**How to apply:** When copying catalog rows without copying media files, preserve the public URLs intentionally and verify them through the Development catalog response.
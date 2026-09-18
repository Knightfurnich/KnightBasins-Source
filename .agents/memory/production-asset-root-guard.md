---
name: Production asset root guard
description: The storefront's production document root and post-deploy asset validation constraint.
---

Production Hostinger serves the storefront at `/`, so production builds must use `BASE_PATH=/` or leave it unset; generated JS/CSS URLs must begin with `/assets/`.

**Why:** A prefixed build can make every asset return 404, while an SPA fallback may return `index.html` with HTTP 200 and hide the failure unless the response content type is checked.

**How to apply:** Keep the build-time path guard and generated-index check enabled, then run the post-deploy web asset checker before production smoke tests. The VPS checker must use only bash, curl, awk/grep, and Python 3 standard library; require HTTP 200, a JavaScript content type, and a non-HTML body for each referenced JS asset. For branding assets that must survive an independently copied document root, prefer a stable file under the web public root (for example `/knight-furnich-logo.svg`) over a hashed imported image.

**Why:** The live storefront served a hashed logo reference from an older bundle while the corresponding PNG was absent, producing a broken-image icon and alt text even though the stable public SVG was available.
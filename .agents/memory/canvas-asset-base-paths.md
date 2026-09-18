---
name: Canvas asset base paths
description: Asset URL handling for Vite-powered Canvas mockup previews
---

Vite's injected BASE_PATH for the Canvas artifact may not include a trailing slash. Public asset URLs must normalize that boundary before appending a filename.

**Why:** Concatenating `${BASE_PATH}images/...` can silently produce a 404 or proxy error such as `/__mockupimages/...`, leaving the preview showing alt text instead of the image.

**How to apply:** Join preview asset paths with a slash-normalizing helper, then verify both the proxied development URL and the built preview URL.
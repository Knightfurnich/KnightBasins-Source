---
name: Storefront build port
description: The Knight Basins Vite config requires PORT even for standalone production builds.
---

Run standalone Storefront builds with an explicit supported `PORT` value; the managed web workflow supplies `PORT` automatically.

**Why:** Running the package build directly without workflow-injected environment variables fails before Vite transforms the app, which can be mistaken for a source or JSX regression.

**How to apply:** Use the normal managed workflow for preview verification. For a one-off build, provide `PORT` in the shell command without changing the workflow or application config.
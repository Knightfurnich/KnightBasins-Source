---
name: Source and artifact parity
description: Keeping committed API and web distribution bundles synchronized with source changes.
---

When a release changes runtime source, rebuild every committed distribution artifact that executes that source before publishing.

**Why:** A source commit can pass local tests while a VPS still runs a stale API or web bundle, causing production behavior to differ from the source and tests.

**How to apply:** Build API and web artifacts separately, verify the generated entry bundle contains the changed behavior, copy the outputs into the repository release directories, then publish and compare remote blob identity plus SHA-256.
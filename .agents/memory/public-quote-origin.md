---
name: Public quote origin
description: Origin selection for absolute quote and sketch notification links behind the VPS proxy chain.
---

Absolute customer-facing quote links must use `PUBLIC_APP_ORIGIN` when configured, otherwise derive the origin from the existing `PUBLIC_UPLOAD_ORIGIN`; only use request headers as a fallback.

**Why:** The proxy chain can make the API observe HTTP even while the customer-facing site is HTTPS, producing broken or misleading Telegram/LINE links.

**How to apply:** Normalize configured values to their URL origin, force `https` in production, and keep header-derived protocol behavior only for development or when no public-origin environment variable exists.
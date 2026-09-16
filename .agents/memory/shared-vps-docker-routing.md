---
name: Shared VPS Docker routing
description: Deployment constraints for applications sharing the Knight VPS and Hermes Docker network.
---

The shared Hostinger VPS runs applications through Docker Compose and Traefik, with projects attached to the external `hermes-agent-2xwn_default` network. Compose service names such as `api` are not globally unique on that network; a proxy using `http://api:8080` can resolve to another project's API intermittently.

**Why:** Knight Basins initially returned alternating 200/404 catalog responses because its Nginx proxy resolved the shared `api` alias to either Knight Basins or Knight Design. The stable fix was to proxy to the unique container name (`knightbasins-api`) and recreate only the storefront web container.

**How to apply:** For any new service on this VPS, use a unique container name in cross-project proxy targets, keep Traefik router/service labels unique, and verify repeated requests through the public hostname before declaring deployment complete.
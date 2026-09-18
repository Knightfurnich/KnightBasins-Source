---
name: Shared VPS Docker routing
description: Deployment constraints for applications sharing the Knight VPS and Hermes Docker network.
---

The shared Hostinger VPS runs applications through Docker Compose and Traefik, with projects attached to the external `hermes-agent-2xwn_default` network. Compose service names such as `api` are not globally unique on that network; a proxy using `http://api:8080` can resolve to another project's API intermittently.

**Why:** Knight Basins initially returned alternating 200/404 catalog responses because its Nginx proxy resolved the shared `api` alias to either Knight Basins or Knight Design. The stable fix was to proxy to the unique container name (`knightbasins-api`) and recreate only the storefront web container.

**How to apply:** For any new service on this VPS, use a unique container name in cross-project proxy targets, keep Traefik router/service labels unique, and verify repeated requests through the public hostname before declaring deployment complete.

Production schema changes must run from the VPS release flow before the API container is recreated; use the PostgreSQL client migration container through the `knightbasins-api` network namespace rather than relying on Node or Drizzle tooling on the host.

**Why:** The VPS deployment is Docker-based and the production database can lag behind the bundle when a release adds columns. Running the versioned SQL files before recreation makes a schema mismatch fail before the new API serves traffic.

**How to apply:** Upload the versioned migration files, run the migration helper with the production API env file, then recreate the API and web containers. Never edit an applied migration; add a new ordered SQL file.
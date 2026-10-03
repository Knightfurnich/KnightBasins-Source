# Knight Basins

Knight Basins is a Thai storefront and work-management system for solid-surface basins, stone products, quotations, and countertop projects.

## Run & Operate

- `pnpm --filter @workspace/knight-basins run dev` — run the storefront and Studio.
- `pnpm --filter @workspace/api-server run dev` — run the API server.
- `pnpm run typecheck` — typecheck workspace libraries and artifacts.
- `pnpm --filter @workspace/knight-basins run test` — run the storefront test suite.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API clients and validation schemas from the OpenAPI contract.
- `pnpm --filter @workspace/db run push` — synchronize the development database schema only. Use a reviewed, explicit migration process for production schema changes.

## System Overview

- **Storefront and Studio:** React, TypeScript, and Vite power the customer-facing catalog, stone viewer, 2D countertop designer, and sketch-submission flow.
- **API:** An Express service provides application endpoints to the storefront and administrative tools.
- **Data:** PostgreSQL stores application records and Drizzle ORM defines the database schema.
- **API contracts:** OpenAPI is the source of truth for generated TypeScript clients and Zod validation schemas.
- **Visual assistance:** AI-powered sketch analysis and catalog-limited stone-color matching support project planning.

## Product Capabilities

- Browse basin models and synthetic-stone colors, view full-slab imagery, and compare product options.
- Design countertop layouts in the 2D Studio, add basins and cutouts, and submit sketches for review and estimates.
- Prepare formal quotations with stone thumbnails and A4/PDF output; share customer-facing quotation links.
- Browse installed-project photography and site-preparation guidance.
- Manage sales leads, customer project details, inventory, project tracking, and digital handover through administrative workflows.
- Share operational updates through configured messaging and map services.

## Repository Map

- `artifacts/knight-basins/` — storefront, Studio, administrative screens, and frontend tests.
- `artifacts/api-server/` — Express API routes, middleware, and server-side application logic.
- `lib/api-spec/` — OpenAPI contract and code-generation scripts.
- `lib/api-client-react/` — generated React API client.
- `lib/api-zod/` — generated Zod request and response schemas.
- `lib/db/src/schema/` — Drizzle database schema.

## Architecture Notes

- Keep API changes contract-first: update the OpenAPI source, regenerate clients and schemas, then update callers.
- Keep database changes additive and reviewed; the development schema-sync command is not a production migration.
- Keep customer-facing features in the storefront artifact and server-side integrations in the API service.
- Use the existing package scripts and tests as the validation path for changes.

## Data Safety

- Do not commit credentials, customer records, or runtime-uploaded files.
- Keep production data changes separate from local development and review them before release.
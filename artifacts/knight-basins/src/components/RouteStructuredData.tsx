import { useEffect, useMemo } from "react";

/**
 * Injects a route-specific JSON-LD block into <head> while the component is
 * mounted, and removes it on unmount.
 *
 * The storefront is a single-page app: the JSON-LD that lives in index.html
 * describes the organization and the home page, but a crawler that lands
 * directly on /portfolio or /site-prep never sees entity data for *that*
 * route. Rather than prerendering every page, each route mounts its own
 * block here. The element carries a stable `data-route-schema` attribute so a
 * route swap replaces its own block instead of stacking duplicates, and the
 * effect keys off the serialized payload so passing an inline object literal
 * cannot trigger a re-render loop.
 */
export function RouteStructuredData({
  id,
  data,
}: {
  /** Stable identifier for this route's block, e.g. "portfolio". */
  id: string;
  /** The complete JSON-LD document to embed. */
  data: Record<string, unknown>;
}) {
  const serialized = useMemo(() => JSON.stringify(data), [data]);

  useEffect(() => {
    const marker = `route-schema-${id}`;
    document.querySelectorAll(`script[data-route-schema="${marker}"]`).forEach((node) => node.remove());

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-route-schema", marker);
    script.textContent = serialized;
    document.head.appendChild(script);

    return () => {
      document.querySelectorAll(`script[data-route-schema="${marker}"]`).forEach((node) => node.remove());
    };
  }, [id, serialized]);

  return null;
}
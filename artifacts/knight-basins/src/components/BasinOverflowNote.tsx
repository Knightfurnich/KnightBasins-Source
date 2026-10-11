/**
 * job 448-B — the one catalogue-level sentence about the overflow hole.
 *
 * The owner's ruling (11 Oct 2026): every basin can be ordered *with or without* an overflow
 * hole, and the factory default is "without". That is a catalogue-wide fact, not a per-model
 * spec, and the database reports `bowlOverflowHole: null` on every row — so a basin card must
 * never print a per-model claim about it (job 447-C removed exactly that). The wording is the
 * API's own string; **we never write the sentence, and we never write a substitute.**
 *
 * The text arrives as `basinOverflowNote` on `GET /api/catalog` (job 447-C ข้อ C, Chai). The
 * generated client still types `Catalog` without the key — it is produced from the OpenAPI
 * spec, which is not this job's file set (`lib/api-client-react/**`) — and because the client
 * fetches with `customFetch<Catalog>` (no schema parsing) the value is present at runtime.
 * Reading it here, off an `unknown`, is what keeps this component working the moment the
 * regenerated type lands, with no copy of the wording inside our source.
 */

/** The key the catalogue uses (job 447-C). Not a label — a field name, kept in one place. */
export const BASIN_OVERFLOW_NOTE_KEY = "basinOverflowNote";

export function overflowNoteFromCatalog(catalog: unknown): string {
  if (typeof catalog !== "object" || catalog === null) return "";
  const value = (catalog as Record<string, unknown>)[BASIN_OVERFLOW_NOTE_KEY];
  return typeof value === "string" ? value.trim() : "";
}

export function BasinOverflowNote({ catalog }: { catalog: unknown }) {
  const note = overflowNoteFromCatalog(catalog);
  // No note from the catalogue => no node. An empty paragraph would be us saying something.
  if (!note) return null;
  return (
    <p
      className="catalog-overflow-note price-note block mb-4 text-pretty leading-relaxed"
      role="note"
      data-testid="text-basin-overflow-note"
      title={note}
    >
      <span className="[overflow-wrap:anywhere]">{note}</span>
    </p>
  );
}

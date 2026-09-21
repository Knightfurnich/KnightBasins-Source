// Toggling the quote-image pin must compare against the *effective* quote
// image (the explicit pin, or the primary image when nothing is pinned) —
// not the raw stored value — otherwise clicking an image that already reads
// as active (via the primary fallback) silently creates an explicit pin
// instead of being a no-op/clear, and the quote image stops following the
// primary image the next time it changes.
export function nextQuoteImageUrl(quoteImageUrl: string | null | undefined, primaryUrl: string | undefined, clickedUrl: string): string | null {
  const effectiveQuoteImage = quoteImageUrl ?? primaryUrl;
  return effectiveQuoteImage === clickedUrl ? null : clickedUrl;
}

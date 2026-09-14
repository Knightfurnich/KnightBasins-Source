export type OriginRequest = {
  protocol: string;
  get(name: string): string | undefined;
};

function configuredPublicOrigin() {
  for (const configured of [process.env["PUBLIC_APP_ORIGIN"], process.env["PUBLIC_UPLOAD_ORIGIN"]]) {
    const value = configured?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (process.env["NODE_ENV"] === "production") url.protocol = "https:";
      return url.origin;
    } catch {
      // Try the next configured origin, then fall back to the request.
    }
  }
  return null;
}

export function requestOrigin(req: OriginRequest) {
  const configured = configuredPublicOrigin();
  if (configured) return configured;

  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = process.env["NODE_ENV"] === "production"
    ? "https"
    : forwardedProto || req.protocol;
  return `${protocol}://${req.get("host") || "localhost"}`;
}
export const LINE_CANONICAL_HOST = "knightbasins.com";
export const LINE_PRODUCTION_HOST = "knightbasins.srv1964473.hstgr.cloud";
export const LINE_CALLBACK_PATH = "/api/auth/line/callback";
export const LINE_CANONICAL_CALLBACK_URL = `https://${LINE_CANONICAL_HOST}${LINE_CALLBACK_PATH}`;
export const LINE_PRODUCTION_CALLBACK_URL = `https://${LINE_PRODUCTION_HOST}${LINE_CALLBACK_PATH}`;
/**
 * Hosts the LINE Login callback is allowed to live on. The owner moved the LINE
 * console to the canonical domain on 8 Oct 2026; the legacy host stays in the
 * list so a rollback in the console keeps working during the transition.
 */
export const LINE_CALLBACK_HOSTS: readonly string[] = [LINE_CANONICAL_HOST, LINE_PRODUCTION_HOST];
export const LINE_LOCAL_CALLBACK_URL = `http://localhost:5000${LINE_CALLBACK_PATH}`;

const LINE_CALLBACK_REASONS = [
  "configured",
  "missing",
  "malformed",
  "not_https",
  "unexpected_host",
  "unexpected_path",
  "unexpected_format",
] as const;

export type LineCallbackReason = (typeof LINE_CALLBACK_REASONS)[number];
export type LineCallbackEnvironment = "production" | "development" | "invalid" | "missing";

export type LineCallbackValidation = {
  valid: boolean;
  environment: LineCallbackEnvironment;
  reason: LineCallbackReason;
};

export type LineAuthDiagnostics = {
  ready: boolean;
  channelConfigured: boolean;
  secretConfigured: boolean;
  callbackUrlConfigured: boolean;
  callbackUrlValid: boolean;
  callbackEnvironment: LineCallbackEnvironment;
  callbackReason: LineCallbackReason;
};

export type LineHealthStatus = "ok" | "degraded";

function lineConfig() {
  return {
    channelId: process.env["LINE_CHANNEL_ID"],
    channelSecret: process.env["LINE_CHANNEL_SECRET"],
    callbackUrl: process.env["LINE_CALLBACK_URL"],
  };
}

export function validateLineCallbackUrl(callbackUrl = process.env["LINE_CALLBACK_URL"]): LineCallbackValidation {
  if (!callbackUrl) {
    return { valid: false, environment: "missing", reason: "missing" };
  }

  let parsed: URL;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return { valid: false, environment: "invalid", reason: "malformed" };
  }

  if (parsed.href === LINE_CANONICAL_CALLBACK_URL || parsed.href === LINE_PRODUCTION_CALLBACK_URL) {
    return { valid: true, environment: "production", reason: "configured" };
  }

  if (process.env["NODE_ENV"] !== "production" && parsed.href === LINE_LOCAL_CALLBACK_URL) {
    return { valid: true, environment: "development", reason: "configured" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, environment: "invalid", reason: "not_https" };
  }

  if (!LINE_CALLBACK_HOSTS.includes(parsed.hostname)) {
    return { valid: false, environment: "invalid", reason: "unexpected_host" };
  }

  if (parsed.pathname !== LINE_CALLBACK_PATH) {
    return { valid: false, environment: "invalid", reason: "unexpected_path" };
  }

  return { valid: false, environment: "invalid", reason: "unexpected_format" };
}

export function getLineAuthDiagnostics(): LineAuthDiagnostics {
  const { channelId, channelSecret, callbackUrl } = lineConfig();
  const callback = validateLineCallbackUrl(callbackUrl);
  const channelConfigured = Boolean(channelId);
  const secretConfigured = Boolean(channelSecret);

  return {
    ready: channelConfigured && secretConfigured && callback.valid,
    channelConfigured,
    secretConfigured,
    callbackUrlConfigured: Boolean(callbackUrl),
    callbackUrlValid: callback.valid,
    callbackEnvironment: callback.environment,
    callbackReason: callback.reason,
  };
}

export function getLineHealthStatus(
  diagnostics = getLineAuthDiagnostics(),
): LineHealthStatus {
  return process.env["NODE_ENV"] === "production" && !diagnostics.ready
    ? "degraded"
    : "ok";
}
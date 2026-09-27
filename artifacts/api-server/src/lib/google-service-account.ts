// Shared service-account auth for every feature that calls a Google Cloud API
// without an API key (the org's GCP project disallows them): the stock-sheet
// sync in admin-router.ts (Google Sheets), google-tts.ts (Cloud
// Text-to-Speech), and vertex-gemini.ts (Vertex AI). Plain JWT Bearer Token
// flow signed here with node:crypto, so no extra dependency
// (google-auth-library etc.) is needed for it. One service account is reused
// across all three by design (ops simplicity over blast-radius isolation).

import { sign as cryptoSign } from "node:crypto";
import { readFileSync } from "node:fs";

export type GoogleServiceAccountCredentials = { client_email: string; private_key: string };

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_LIFETIME_SECONDS = 3600;

/** Looks for the credentials as inline JSON first (GOOGLE_SERVICE_ACCOUNT_JSON),
 * then as a file path (GOOGLE_APPLICATION_CREDENTIALS, or the two conventional
 * locations the work order names for the server and a dev machine). */
export function loadGoogleServiceAccountCredentials(): GoogleServiceAccountCredentials | null {
  if (process.env["GOOGLE_SERVICE_ACCOUNT_DISABLED"] === "true") return null;

  const parseIfValid = (raw: string): GoogleServiceAccountCredentials | null => {
    try {
      const parsed = JSON.parse(raw) as Partial<GoogleServiceAccountCredentials>;
      return typeof parsed.client_email === "string" && typeof parsed.private_key === "string"
        ? { client_email: parsed.client_email, private_key: parsed.private_key }
        : null;
    } catch {
      return null;
    }
  };

  const inline = process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  if (inline) {
    const credentials = parseIfValid(inline);
    if (credentials) return credentials;
  }

  const candidatePaths = [
    process.env["GOOGLE_APPLICATION_CREDENTIALS"],
    "/app/google-credentials.json",
    "./google-credentials.json",
    "/docker/knightbasins/google-credentials.json",
    "/opt/data/.google-credentials.json",
  ].filter((path): path is string => Boolean(path));

  for (const path of candidatePaths) {
    try {
      const credentials = parseIfValid(readFileSync(path, "utf8"));
      if (credentials) return credentials;
    } catch {
      // try the next candidate path
    }
  }
  return null;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/** Signs a Google service-account JWT and exchanges it for an access token
 * (the standard JWT Bearer Token flow for server-to-server auth). `scope`
 * is caller-specific -- e.g. spreadsheets.readonly for the stock sync,
 * cloud-platform for Cloud Text-to-Speech. */
export async function fetchGoogleAccessToken(credentials: GoogleServiceAccountCredentials, scope: string): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: credentials.client_email,
    scope,
    aud: GOOGLE_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_LIFETIME_SECONDS,
  }));
  const unsigned = `${header}.${claims}`;
  const signature = cryptoSign("RSA-SHA256", Buffer.from(unsigned), credentials.private_key).toString("base64url");
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google token exchange failed with ${response.status}`);
  const payload = await response.json() as { access_token?: unknown };
  if (typeof payload.access_token !== "string") throw new Error("Google token exchange returned no access_token");
  return payload.access_token;
}

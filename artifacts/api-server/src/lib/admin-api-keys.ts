import { createHash, randomBytes } from "node:crypto";

export const ADMIN_API_KEY_SCOPE = "leads:edit" as const;
export const ADMIN_API_KEY_PREFIX = "kbw_";

export function hashAdminApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createAdminApiKeySecret() {
  const token = `${ADMIN_API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  return {
    token,
    keyPrefix: token.slice(0, ADMIN_API_KEY_PREFIX.length + 8),
    tokenHash: hashAdminApiKey(token),
  };
}

export function isAdminApiKeyShape(value: string | undefined): value is string {
  return Boolean(value && value.startsWith(ADMIN_API_KEY_PREFIX) && value.length >= 40 && value.length <= 80);
}
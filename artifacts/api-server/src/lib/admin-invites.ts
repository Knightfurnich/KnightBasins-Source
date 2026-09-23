import { createHash, randomBytes } from "node:crypto";

export function hashAdminInviteValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createAdminInviteSecrets() {
  return {
    token: randomBytes(24).toString("base64url"),
    code: randomBytes(6).toString("hex").toUpperCase(),
  };
}

export function inviteValueFromReturnTo(returnTo: string) {
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return null;
  try {
    const url = new URL(returnTo, "http://knight-furnich.local");
    if (!url.pathname.startsWith("/admin")) return null;
    const value = url.searchParams.get("invite")?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function removeInviteFromReturnTo(returnTo: string) {
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return "/admin";
  try {
    const url = new URL(returnTo, "http://knight-furnich.local");
    url.searchParams.delete("invite");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/admin";
  }
}
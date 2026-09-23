import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createAdminInviteSecrets,
  hashAdminInviteValue,
  inviteValueFromReturnTo,
  removeInviteFromReturnTo,
} from "../src/lib/admin-invites.ts";

describe("admin invite values", () => {
  it("creates a long link token and a short copyable code", () => {
    const first = createAdminInviteSecrets();
    const second = createAdminInviteSecrets();

    assert.match(first.token, /^[A-Za-z0-9_-]{32}$/);
    assert.match(first.code, /^[A-F0-9]{12}$/);
    assert.notEqual(first.token, second.token);
    assert.notEqual(first.code, second.code);
    assert.notEqual(hashAdminInviteValue(first.token), first.token);
  });

  it("extracts invite values only from an internal admin return path", () => {
    assert.equal(
      inviteValueFromReturnTo("/admin?invite=ABC123&tab=team"),
      "ABC123",
    );
    assert.equal(inviteValueFromReturnTo("https://evil.example.com/admin?invite=x"), null);
    assert.equal(inviteValueFromReturnTo("/quote?invite=x"), null);
  });

  it("removes the one-time invite from the URL after callback", () => {
    assert.equal(
      removeInviteFromReturnTo("/admin?invite=ABC123&tab=team"),
      "/admin?tab=team",
    );
    assert.equal(removeInviteFromReturnTo("/admin?invite=ABC123"), "/admin");
  });
});
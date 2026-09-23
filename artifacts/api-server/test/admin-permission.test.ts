import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  accessForAdminMember,
  adminMemberIdFromToken,
  createAdminToken,
  getAdminAccess,
  hasAdminPermission,
  type AdminRole,
} from "../src/middlewares/admin-auth.ts";

const ORIGINAL_ENV = {
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
  SESSION_SECRET: process.env["SESSION_SECRET"],
};

function restoreEnvironment() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

before(() => {
  delete process.env["ADMIN_ROLE"];
  delete process.env["ADMIN_PERMISSIONS"];
  process.env["SESSION_SECRET"] = "admin-permission-test-secret";
});

after(restoreEnvironment);

describe("admin access policy", () => {
  it("keeps the existing password session as a full-access owner by default", () => {
    const access = getAdminAccess();

    assert.equal(access.role, "owner");
    assert.deepEqual(access.permissions, ["basins", "installed-stones", "sheet-stones", "leads"]);
    assert.equal(access.canEdit, true);
    assert.equal(access.canDelete, true);
    assert.equal(access.canManageTeam, true);
  });

  it("lets a staff policy restrict visible admin modules", () => {
    process.env["ADMIN_ROLE"] = "staff";
    process.env["ADMIN_PERMISSIONS"] = "leads,basins";
    const access = getAdminAccess();

    assert.equal(access.role, "staff");
    assert.equal(hasAdminPermission(access, "leads"), true);
    assert.equal(hasAdminPermission(access, "basins"), true);
    assert.equal(hasAdminPermission(access, "sheet-stones"), false);
    assert.equal(hasAdminPermission(access, "leads", "edit"), true);
    assert.equal(hasAdminPermission(access, "leads", "delete"), false);
  });

  it("allows viewer access without allowing edits or deletes", () => {
    process.env["ADMIN_ROLE"] = "viewer";
    process.env["ADMIN_PERMISSIONS"] = "leads";
    const access = getAdminAccess();

    assert.equal(access.role satisfies AdminRole, "viewer");
    assert.equal(hasAdminPermission(access, "leads"), true);
    assert.equal(hasAdminPermission(access, "leads", "edit"), false);
    assert.equal(hasAdminPermission(access, "leads", "delete"), false);
  });

  it("keeps member sessions distinct from the shared-password owner session", () => {
    const sharedToken = createAdminToken();
    const memberToken = createAdminToken(42);

    assert.equal(adminMemberIdFromToken(sharedToken), null);
    assert.equal(adminMemberIdFromToken(memberToken), 42);
    assert.deepEqual(accessForAdminMember({
      role: "staff",
      permissions: ["leads"],
    }), {
      role: "staff",
      permissions: ["leads"],
      canEdit: true,
      canDelete: false,
      canManageTeam: false,
    });
  });

  it("gives owner members all four modules regardless of stored module values", () => {
    assert.deepEqual(accessForAdminMember({
      role: "owner",
      permissions: [],
    }).permissions, ["basins", "installed-stones", "sheet-stones", "leads"]);
  });
});
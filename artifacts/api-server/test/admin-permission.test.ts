import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  getAdminAccess,
  hasAdminPermission,
  type AdminRole,
} from "../src/middlewares/admin-auth.ts";

const ORIGINAL_ENV = {
  ADMIN_ROLE: process.env["ADMIN_ROLE"],
  ADMIN_PERMISSIONS: process.env["ADMIN_PERMISSIONS"],
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
});
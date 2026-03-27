/**
 * RBAC Permission Matrix — Test Suite
 *
 * Validates the permission matrix, role hierarchy, and helper functions.
 * Tests that each role has the correct scope and action access.
 */

import { describe, it, expect } from "vitest";
import { UserRole, ROLE_HIERARCHY, hasMinimumRole } from "../constants/roles";
import {
  PERMISSIONS,
  hasPermission,
  getPermissionScope,
} from "../constants/permissions";
import type { Action, Resource, Scope } from "../constants/permissions";

describe("RBAC Permission Matrix", () => {
  // ── PATIENT role ───────────────────────────────────────────────────

  describe("PATIENT role", () => {
    const role = UserRole.PATIENT;

    it("can read own patient record", () => {
      expect(hasPermission(role, "patient", "read")).toBe(true);
    });

    it("can update own patient record", () => {
      expect(hasPermission(role, "patient", "update")).toBe(true);
    });

    it("cannot create patient records", () => {
      expect(hasPermission(role, "patient", "create")).toBe(false);
    });

    it("cannot delete patient records", () => {
      expect(hasPermission(role, "patient", "delete")).toBe(false);
    });

    it("cannot list all patients", () => {
      expect(hasPermission(role, "patient", "list")).toBe(false);
    });

    it("can create and read own appointments", () => {
      expect(hasPermission(role, "appointment", "create")).toBe(true);
      expect(hasPermission(role, "appointment", "read")).toBe(true);
      expect(hasPermission(role, "appointment", "list")).toBe(true);
    });

    it("cannot update or delete appointments", () => {
      expect(hasPermission(role, "appointment", "update")).toBe(false);
      expect(hasPermission(role, "appointment", "delete")).toBe(false);
    });

    it("can read own visit notes", () => {
      expect(hasPermission(role, "visit_note", "read")).toBe(true);
    });

    it("cannot create visit notes", () => {
      expect(hasPermission(role, "visit_note", "create")).toBe(false);
    });

    it("can read and list own billing records", () => {
      expect(hasPermission(role, "billing", "read")).toBe(true);
      expect(hasPermission(role, "billing", "list")).toBe(true);
    });

    it("cannot access user management", () => {
      expect(hasPermission(role, "user", "read")).toBe(false);
      expect(hasPermission(role, "user", "create")).toBe(false);
    });

    it("cannot access audit logs", () => {
      expect(hasPermission(role, "audit_log", "read")).toBe(false);
    });

    it("cannot access tenant management", () => {
      expect(hasPermission(role, "tenant", "read")).toBe(false);
    });

    it('has "own" scope for patient resource', () => {
      expect(getPermissionScope(role, "patient")).toBe("own");
    });

    it('has "own" scope for appointment resource', () => {
      expect(getPermissionScope(role, "appointment")).toBe("own");
    });
  });

  // ── DOCTOR role ────────────────────────────────────────────────────

  describe("DOCTOR role", () => {
    const role = UserRole.DOCTOR;

    it("can read and list assigned patient records", () => {
      expect(hasPermission(role, "patient", "read")).toBe(true);
      expect(hasPermission(role, "patient", "list")).toBe(true);
    });

    it("cannot create or delete patient records", () => {
      expect(hasPermission(role, "patient", "create")).toBe(false);
      expect(hasPermission(role, "patient", "delete")).toBe(false);
    });

    it("can read, update, and list assigned appointments", () => {
      expect(hasPermission(role, "appointment", "read")).toBe(true);
      expect(hasPermission(role, "appointment", "update")).toBe(true);
      expect(hasPermission(role, "appointment", "list")).toBe(true);
    });

    it("cannot create or delete appointments", () => {
      expect(hasPermission(role, "appointment", "create")).toBe(false);
      expect(hasPermission(role, "appointment", "delete")).toBe(false);
    });

    it("can create, read, and update visit notes", () => {
      expect(hasPermission(role, "visit_note", "create")).toBe(true);
      expect(hasPermission(role, "visit_note", "read")).toBe(true);
      expect(hasPermission(role, "visit_note", "update")).toBe(true);
    });

    it("cannot access user management", () => {
      expect(hasPermission(role, "user", "read")).toBe(false);
    });

    it('has "assigned" scope for patient resource', () => {
      expect(getPermissionScope(role, "patient")).toBe("assigned");
    });

    it('has "assigned" scope for appointment resource', () => {
      expect(getPermissionScope(role, "appointment")).toBe("assigned");
    });
  });

  // ── ADMIN role ─────────────────────────────────────────────────────

  describe("ADMIN role", () => {
    const role = UserRole.ADMIN;

    it("has full CRUD + export on patient records within tenant", () => {
      expect(hasPermission(role, "patient", "create")).toBe(true);
      expect(hasPermission(role, "patient", "read")).toBe(true);
      expect(hasPermission(role, "patient", "update")).toBe(true);
      expect(hasPermission(role, "patient", "delete")).toBe(true);
      expect(hasPermission(role, "patient", "list")).toBe(true);
      expect(hasPermission(role, "patient", "export")).toBe(true);
    });

    it("has full CRUD on appointments within tenant", () => {
      expect(hasPermission(role, "appointment", "create")).toBe(true);
      expect(hasPermission(role, "appointment", "delete")).toBe(true);
    });

    it("can manage users within tenant", () => {
      expect(hasPermission(role, "user", "create")).toBe(true);
      expect(hasPermission(role, "user", "read")).toBe(true);
      expect(hasPermission(role, "user", "update")).toBe(true);
      expect(hasPermission(role, "user", "delete")).toBe(true);
      expect(hasPermission(role, "user", "list")).toBe(true);
    });

    it("can read audit logs within tenant", () => {
      expect(hasPermission(role, "audit_log", "read")).toBe(true);
      expect(hasPermission(role, "audit_log", "list")).toBe(true);
    });

    it("cannot access tenant management", () => {
      expect(hasPermission(role, "tenant", "read")).toBe(false);
      expect(hasPermission(role, "tenant", "create")).toBe(false);
    });

    it("can access reports", () => {
      expect(hasPermission(role, "report", "read")).toBe(true);
      expect(hasPermission(role, "report", "export")).toBe(true);
    });

    it('has "tenant" scope for all resources', () => {
      expect(getPermissionScope(role, "patient")).toBe("tenant");
      expect(getPermissionScope(role, "appointment")).toBe("tenant");
      expect(getPermissionScope(role, "user")).toBe("tenant");
      expect(getPermissionScope(role, "billing")).toBe("tenant");
    });
  });

  // ── SUPER_ADMIN role ───────────────────────────────────────────────

  describe("SUPER_ADMIN role", () => {
    const role = UserRole.SUPER_ADMIN;

    it("has global scope on all resources", () => {
      const resources: Resource[] = [
        "patient",
        "appointment",
        "visit_note",
        "billing",
        "insurance",
        "user",
        "tenant",
        "audit_log",
        "report",
      ];
      for (const resource of resources) {
        expect(getPermissionScope(role, resource)).toBe("global");
      }
    });

    it("can manage tenants", () => {
      expect(hasPermission(role, "tenant", "create")).toBe(true);
      expect(hasPermission(role, "tenant", "read")).toBe(true);
      expect(hasPermission(role, "tenant", "update")).toBe(true);
      expect(hasPermission(role, "tenant", "delete")).toBe(true);
      expect(hasPermission(role, "tenant", "list")).toBe(true);
    });

    it("can export audit logs", () => {
      expect(hasPermission(role, "audit_log", "export")).toBe(true);
    });

    it("has full CRUD + export on all resources", () => {
      expect(hasPermission(role, "patient", "create")).toBe(true);
      expect(hasPermission(role, "patient", "export")).toBe(true);
      expect(hasPermission(role, "user", "delete")).toBe(true);
      expect(hasPermission(role, "billing", "delete")).toBe(true);
    });
  });

  // ── hasPermission() ────────────────────────────────────────────────

  describe("hasPermission()", () => {
    it("returns true for allowed action on resource", () => {
      expect(hasPermission(UserRole.ADMIN, "patient", "create")).toBe(true);
    });

    it("returns false for disallowed action on resource", () => {
      expect(hasPermission(UserRole.PATIENT, "patient", "delete")).toBe(false);
    });

    it("returns false for resource the role has no access to", () => {
      expect(hasPermission(UserRole.PATIENT, "tenant", "read")).toBe(false);
    });

    it("correctly handles all action types", () => {
      const actions: Action[] = [
        "create",
        "read",
        "update",
        "delete",
        "list",
        "export",
      ];
      for (const action of actions) {
        const result = hasPermission(UserRole.SUPER_ADMIN, "patient", action);
        expect(typeof result).toBe("boolean");
        expect(result).toBe(true); // SUPER_ADMIN has all actions on patient
      }
    });
  });

  // ── getPermissionScope() ───────────────────────────────────────────

  describe("getPermissionScope()", () => {
    it('returns "own" for PATIENT on patient resource', () => {
      expect(getPermissionScope(UserRole.PATIENT, "patient")).toBe("own");
    });

    it('returns "assigned" for DOCTOR on patient resource', () => {
      expect(getPermissionScope(UserRole.DOCTOR, "patient")).toBe("assigned");
    });

    it('returns "tenant" for ADMIN on patient resource', () => {
      expect(getPermissionScope(UserRole.ADMIN, "patient")).toBe("tenant");
    });

    it('returns "global" for SUPER_ADMIN on patient resource', () => {
      expect(getPermissionScope(UserRole.SUPER_ADMIN, "patient")).toBe(
        "global",
      );
    });

    it("returns null for resources the role cannot access", () => {
      expect(getPermissionScope(UserRole.PATIENT, "tenant")).toBeNull();
      expect(getPermissionScope(UserRole.PATIENT, "user")).toBeNull();
      expect(getPermissionScope(UserRole.DOCTOR, "tenant")).toBeNull();
    });
  });

  // ── hasMinimumRole() ───────────────────────────────────────────────

  describe("hasMinimumRole()", () => {
    it("SUPER_ADMIN meets minimum of any role", () => {
      expect(hasMinimumRole(UserRole.SUPER_ADMIN, UserRole.PATIENT)).toBe(true);
      expect(hasMinimumRole(UserRole.SUPER_ADMIN, UserRole.DOCTOR)).toBe(true);
      expect(hasMinimumRole(UserRole.SUPER_ADMIN, UserRole.ADMIN)).toBe(true);
      expect(hasMinimumRole(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(
        true,
      );
    });

    it("PATIENT does not meet minimum of DOCTOR", () => {
      expect(hasMinimumRole(UserRole.PATIENT, UserRole.DOCTOR)).toBe(false);
    });

    it("PATIENT does not meet minimum of ADMIN", () => {
      expect(hasMinimumRole(UserRole.PATIENT, UserRole.ADMIN)).toBe(false);
    });

    it("DOCTOR meets minimum of PATIENT", () => {
      expect(hasMinimumRole(UserRole.DOCTOR, UserRole.PATIENT)).toBe(true);
    });

    it("DOCTOR does not meet minimum of ADMIN", () => {
      expect(hasMinimumRole(UserRole.DOCTOR, UserRole.ADMIN)).toBe(false);
    });

    it("ADMIN meets minimum of DOCTOR", () => {
      expect(hasMinimumRole(UserRole.ADMIN, UserRole.DOCTOR)).toBe(true);
    });

    it("same role meets its own minimum", () => {
      for (const role of ROLE_HIERARCHY) {
        expect(hasMinimumRole(role, role)).toBe(true);
      }
    });

    it("respects the full hierarchy order: PATIENT < DOCTOR < ADMIN < SUPER_ADMIN", () => {
      expect(ROLE_HIERARCHY).toEqual([
        UserRole.PATIENT,
        UserRole.DOCTOR,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
      ]);
    });
  });

  // ── Permission matrix integrity ────────────────────────────────────

  describe("Permission matrix integrity", () => {
    it("every role has at least one permission", () => {
      for (const role of ROLE_HIERARCHY) {
        expect(PERMISSIONS[role].length).toBeGreaterThan(0);
      }
    });

    it("higher roles have equal or more permissions than lower roles", () => {
      const patientPerms = PERMISSIONS[UserRole.PATIENT].length;
      const doctorPerms = PERMISSIONS[UserRole.DOCTOR].length;
      const adminPerms = PERMISSIONS[UserRole.ADMIN].length;
      const superAdminPerms = PERMISSIONS[UserRole.SUPER_ADMIN].length;

      expect(doctorPerms).toBeGreaterThanOrEqual(patientPerms);
      expect(adminPerms).toBeGreaterThanOrEqual(doctorPerms);
      expect(superAdminPerms).toBeGreaterThanOrEqual(adminPerms);
    });

    it("scope escalates with role hierarchy: own -> assigned -> tenant -> global", () => {
      const scopeOrder: Scope[] = ["own", "assigned", "tenant", "global"];

      const patientScope = getPermissionScope(UserRole.PATIENT, "patient");
      const doctorScope = getPermissionScope(UserRole.DOCTOR, "patient");
      const adminScope = getPermissionScope(UserRole.ADMIN, "patient");
      const superAdminScope = getPermissionScope(
        UserRole.SUPER_ADMIN,
        "patient",
      );

      expect(scopeOrder.indexOf(patientScope!)).toBeLessThan(
        scopeOrder.indexOf(doctorScope!),
      );
      expect(scopeOrder.indexOf(doctorScope!)).toBeLessThan(
        scopeOrder.indexOf(adminScope!),
      );
      expect(scopeOrder.indexOf(adminScope!)).toBeLessThan(
        scopeOrder.indexOf(superAdminScope!),
      );
    });

    it("only SUPER_ADMIN can access tenant resource", () => {
      expect(hasPermission(UserRole.PATIENT, "tenant", "read")).toBe(false);
      expect(hasPermission(UserRole.DOCTOR, "tenant", "read")).toBe(false);
      expect(hasPermission(UserRole.ADMIN, "tenant", "read")).toBe(false);
      expect(hasPermission(UserRole.SUPER_ADMIN, "tenant", "read")).toBe(true);
    });
  });
});

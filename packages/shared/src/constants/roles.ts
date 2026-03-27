/**
 * ClearHealth — User Role Definitions
 *
 * Defines the role hierarchy for the platform. Roles determine access
 * to resources, actions, and UI features throughout the application.
 *
 * @security Role assignments are stored in the database and embedded in JWT tokens.
 * Role changes require ADMIN or SUPER_ADMIN privileges and are logged in the audit trail.
 */

/** User roles in the ClearHealth platform */
export enum UserRole {
  /** Can view own records, book appointments, manage own profile */
  PATIENT = "PATIENT",
  /** Can manage schedules, write visit notes, view assigned patient records */
  DOCTOR = "DOCTOR",
  /** Can manage staff, view billing, access all records within their tenant */
  ADMIN = "ADMIN",
  /** Platform-wide access across all tenants — reserved for ClearHealth operations team */
  SUPER_ADMIN = "SUPER_ADMIN",
}

/** Role hierarchy — higher index = more privileges */
export const ROLE_HIERARCHY: UserRole[] = [
  UserRole.PATIENT,
  UserRole.DOCTOR,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
];

/** Human-readable role display names */
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.PATIENT]: "Patient",
  [UserRole.DOCTOR]: "Doctor",
  [UserRole.ADMIN]: "Clinic Administrator",
  [UserRole.SUPER_ADMIN]: "Super Administrator",
};

/**
 * Checks whether a given role has equal or higher privileges than the required role.
 */
export function hasMinimumRole(
  userRole: UserRole,
  requiredRole: UserRole,
): boolean {
  return (
    ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(requiredRole)
  );
}

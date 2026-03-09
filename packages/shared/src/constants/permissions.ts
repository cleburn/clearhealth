/**
 * ClearHealth — Role-Based Access Control (RBAC) Permission Matrix
 *
 * This matrix is the source of truth for RBAC. Both API middleware and
 * frontend route guards reference these constants.
 *
 * @security Changes to this file require security review.
 * Any modification to permissions must be approved by the backend team lead
 * and documented in the audit trail.
 */

import { UserRole } from './roles';

/** Actions that can be performed on resources */
export type Action = 'create' | 'read' | 'update' | 'delete' | 'list' | 'export';

/** Resources in the ClearHealth platform */
export type Resource =
  | 'patient'
  | 'appointment'
  | 'visit_note'
  | 'billing'
  | 'insurance'
  | 'user'
  | 'tenant'
  | 'audit_log'
  | 'report';

/** Permission scope — controls which records a role can access */
export type Scope = 'own' | 'assigned' | 'tenant' | 'global';

/** A single permission entry */
export interface Permission {
  resource: Resource;
  actions: Action[];
  scope: Scope;
}

/**
 * Permission matrix — defines what each role can do.
 *
 * Scope meanings:
 * - own: Only records belonging to the authenticated user
 * - assigned: Records assigned to the user (e.g., a doctor's patients)
 * - tenant: All records within the user's tenant/clinic
 * - global: All records across all tenants (SUPER_ADMIN only)
 */
export const PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.PATIENT]: [
    { resource: 'patient', actions: ['read', 'update'], scope: 'own' },
    { resource: 'appointment', actions: ['create', 'read', 'list'], scope: 'own' },
    { resource: 'visit_note', actions: ['read'], scope: 'own' },
    { resource: 'billing', actions: ['read', 'list'], scope: 'own' },
    { resource: 'insurance', actions: ['read'], scope: 'own' },
  ],

  [UserRole.DOCTOR]: [
    { resource: 'patient', actions: ['read', 'list'], scope: 'assigned' },
    { resource: 'appointment', actions: ['read', 'update', 'list'], scope: 'assigned' },
    { resource: 'visit_note', actions: ['create', 'read', 'update'], scope: 'assigned' },
    { resource: 'billing', actions: ['read', 'list'], scope: 'assigned' },
    { resource: 'insurance', actions: ['read'], scope: 'assigned' },
  ],

  [UserRole.ADMIN]: [
    { resource: 'patient', actions: ['create', 'read', 'update', 'delete', 'list', 'export'], scope: 'tenant' },
    { resource: 'appointment', actions: ['create', 'read', 'update', 'delete', 'list', 'export'], scope: 'tenant' },
    { resource: 'visit_note', actions: ['read', 'list'], scope: 'tenant' },
    { resource: 'billing', actions: ['create', 'read', 'update', 'list', 'export'], scope: 'tenant' },
    { resource: 'insurance', actions: ['read', 'list'], scope: 'tenant' },
    { resource: 'user', actions: ['create', 'read', 'update', 'delete', 'list'], scope: 'tenant' },
    { resource: 'audit_log', actions: ['read', 'list'], scope: 'tenant' },
    { resource: 'report', actions: ['read', 'list', 'export'], scope: 'tenant' },
  ],

  [UserRole.SUPER_ADMIN]: [
    { resource: 'patient', actions: ['create', 'read', 'update', 'delete', 'list', 'export'], scope: 'global' },
    { resource: 'appointment', actions: ['create', 'read', 'update', 'delete', 'list', 'export'], scope: 'global' },
    { resource: 'visit_note', actions: ['read', 'list', 'export'], scope: 'global' },
    { resource: 'billing', actions: ['create', 'read', 'update', 'delete', 'list', 'export'], scope: 'global' },
    { resource: 'insurance', actions: ['read', 'list', 'export'], scope: 'global' },
    { resource: 'user', actions: ['create', 'read', 'update', 'delete', 'list', 'export'], scope: 'global' },
    { resource: 'tenant', actions: ['create', 'read', 'update', 'delete', 'list'], scope: 'global' },
    { resource: 'audit_log', actions: ['read', 'list', 'export'], scope: 'global' },
    { resource: 'report', actions: ['read', 'list', 'export'], scope: 'global' },
  ],
};

/**
 * Checks if a role has permission to perform an action on a resource.
 */
export function hasPermission(role: UserRole, resource: Resource, action: Action): boolean {
  const rolePermissions = PERMISSIONS[role];
  return rolePermissions.some(
    (p) => p.resource === resource && p.actions.includes(action)
  );
}

/**
 * Gets the scope for a role's access to a resource.
 * Returns null if the role has no access to the resource.
 */
export function getPermissionScope(role: UserRole, resource: Resource): Scope | null {
  const rolePermissions = PERMISSIONS[role];
  const permission = rolePermissions.find((p) => p.resource === resource);
  return permission?.scope ?? null;
}

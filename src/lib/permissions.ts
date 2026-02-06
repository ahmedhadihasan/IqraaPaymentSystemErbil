/**
 * IqraaPay - Role-Based Access Control (RBAC)
 * 
 * Roles:
 * - super_admin:      Full access to everything (create, edit, delete, view all)
 * - super_admin_view: Can view everything but cannot create, edit or delete
 * - admin:            Can manage (create, edit) students & payments in assigned classes
 * - admin_view:       Can only view students & payments in assigned classes
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SUPER_ADMIN_VIEW: 'super_admin_view',
  ADMIN: 'admin',
  ADMIN_VIEW: 'admin_view',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'سەرپەرشتیار (تەواو)',
  super_admin_view: 'سەرپەرشتیار (بینین)',
  admin: 'بەڕێوەبەر (تەواو)',
  admin_view: 'بەڕێوەبەر (بینین)',
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: 'دەسەڵاتی تەواو - زیادکردن، دەستکاری، سڕینەوە، بینینی هەموو شت',
  super_admin_view: 'تەنها بینینی هەموو شت - ناتوانێت هیچ گۆڕانکارییەک بکات',
  admin: 'بەڕێوەبردنی قوتابیان و پارەدان لە پۆلە دیاریکراوەکان',
  admin_view: 'تەنها بینینی قوتابیان و پارەدان لە پۆلە دیاریکراوەکان',
};

/**
 * Permission definitions
 */
export const PERMISSIONS = {
  // Student permissions
  STUDENTS_VIEW_ALL: 'students.view_all',
  STUDENTS_VIEW_ASSIGNED: 'students.view_assigned',
  STUDENTS_CREATE: 'students.create',
  STUDENTS_EDIT: 'students.edit',
  STUDENTS_DELETE: 'students.delete',
  STUDENTS_IMPORT: 'students.import',
  STUDENTS_EXPORT: 'students.export',

  // Payment permissions
  PAYMENTS_VIEW_ALL: 'payments.view_all',
  PAYMENTS_VIEW_ASSIGNED: 'payments.view_assigned',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_VOID: 'payments.void',

  // Admin permissions
  ADMINS_VIEW: 'admins.view',
  ADMINS_CREATE: 'admins.create',
  ADMINS_EDIT: 'admins.edit',
  ADMINS_DELETE: 'admins.delete',
  ADMINS_RESET_PASSWORD: 'admins.reset_password',

  // System permissions
  SYSTEM_SETTINGS: 'system.settings',
  SYSTEM_DANGER_ZONE: 'system.danger_zone',
  SYSTEM_REPORTS: 'system.reports',
  SYSTEM_MANAGE_CLASSES: 'system.manage_classes',
  SYSTEM_MANAGE_BOOKS: 'system.manage_books',

  // View sensitive info
  VIEW_CREDENTIALS: 'view.credentials',
} as const;

/**
 * Role-Permission mapping
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    // All permissions
    PERMISSIONS.STUDENTS_VIEW_ALL,
    PERMISSIONS.STUDENTS_VIEW_ASSIGNED,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_EDIT,
    PERMISSIONS.STUDENTS_DELETE,
    PERMISSIONS.STUDENTS_IMPORT,
    PERMISSIONS.STUDENTS_EXPORT,
    PERMISSIONS.PAYMENTS_VIEW_ALL,
    PERMISSIONS.PAYMENTS_VIEW_ASSIGNED,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_VOID,
    PERMISSIONS.ADMINS_VIEW,
    PERMISSIONS.ADMINS_CREATE,
    PERMISSIONS.ADMINS_EDIT,
    PERMISSIONS.ADMINS_DELETE,
    PERMISSIONS.ADMINS_RESET_PASSWORD,
    PERMISSIONS.SYSTEM_SETTINGS,
    PERMISSIONS.SYSTEM_DANGER_ZONE,
    PERMISSIONS.SYSTEM_REPORTS,
    PERMISSIONS.SYSTEM_MANAGE_CLASSES,
    PERMISSIONS.SYSTEM_MANAGE_BOOKS,
    PERMISSIONS.VIEW_CREDENTIALS,
  ],
  super_admin_view: [
    // View everything, no edit/delete/create
    PERMISSIONS.STUDENTS_VIEW_ALL,
    PERMISSIONS.STUDENTS_VIEW_ASSIGNED,
    PERMISSIONS.STUDENTS_EXPORT,
    PERMISSIONS.PAYMENTS_VIEW_ALL,
    PERMISSIONS.PAYMENTS_VIEW_ASSIGNED,
    PERMISSIONS.ADMINS_VIEW,
    PERMISSIONS.SYSTEM_REPORTS,
    // No VIEW_CREDENTIALS - only full super_admin sees passwords
  ],
  admin: [
    // Manage assigned students and payments
    PERMISSIONS.STUDENTS_VIEW_ASSIGNED,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_EDIT,
    PERMISSIONS.STUDENTS_EXPORT,
    PERMISSIONS.PAYMENTS_VIEW_ASSIGNED,
    PERMISSIONS.PAYMENTS_CREATE,
  ],
  admin_view: [
    // View assigned students and payments only
    PERMISSIONS.STUDENTS_VIEW_ASSIGNED,
    PERMISSIONS.PAYMENTS_VIEW_ASSIGNED,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Check if user is any type of super admin
 */
export function isSuperAdminRole(role: string): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.SUPER_ADMIN_VIEW;
}

/**
 * Check if user is any type of admin (non-super)
 */
export function isAdminRole(role: string): boolean {
  return role === ROLES.ADMIN || role === ROLES.ADMIN_VIEW;
}

/**
 * Check if role can edit/create data
 */
export function canEdit(role: string): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}

/**
 * Check if role can view all data (not just assigned)
 */
export function canViewAll(role: string): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.SUPER_ADMIN_VIEW;
}

/**
 * Check if role can manage admins (create/edit/delete)
 */
export function canManageAdmins(role: string): boolean {
  return role === ROLES.SUPER_ADMIN;
}

/**
 * Check if role can view admin list page
 */
export function canViewAdmins(role: string): boolean {
  return hasPermission(role, PERMISSIONS.ADMINS_VIEW);
}

/**
 * Check if role can view credentials (passwords, usernames)
 */
export function canViewCredentials(role: string): boolean {
  return hasPermission(role, PERMISSIONS.VIEW_CREDENTIALS);
}

/**
 * Get all available roles for display
 */
export function getAllRoles(): Array<{ value: string; label: string; description: string }> {
  return Object.values(ROLES).map(role => ({
    value: role,
    label: ROLE_LABELS[role] || role,
    description: ROLE_DESCRIPTIONS[role] || '',
  }));
}

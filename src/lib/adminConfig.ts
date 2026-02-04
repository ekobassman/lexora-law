/**
 * Admin config: single source for admin email(s).
 * Used by ProtectedRoute, AdminPanel, useEntitlements for client-side fallback
 * when DB (user_roles / profiles.is_admin) is not yet populated after migration.
 */
export const ADMIN_EMAILS = ["imbimbo.bassman@gmail.com"] as const;

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((e) => e.toLowerCase() === lower);
}

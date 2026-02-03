import { test, expect } from '@playwright/test';

/**
 * E2E: Admin Panel flow
 * - /admin without auth -> redirect to /auth (or /login)
 * - /admin with auth but not admin -> redirect to /app
 * - Verify Admin link in header/menu when on /app (requires admin user - skip if no auth)
 */

test.describe('Admin Panel', () => {
  test('visiting /admin unauthenticated redirects to auth', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    // Should redirect to login/auth, not stay on /admin
    expect(url).toMatch(/\/(auth|login|signup)/);
  });

  test('admin route loads without 500', async ({ page }) => {
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await page.waitForTimeout(1500);
    const url = page.url();
    // After redirect we should be on auth or app
    expect(url).toMatch(/\/(auth|login|app|dashboard)/);
  });

  test('direct navigation to /admin eventually leaves /admin (redirect)', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(2000);
    const url = page.url();
    // Unauthenticated or non-admin: must not stay on /admin
    const stillOnAdmin = url.includes('/admin') && !url.includes('/admin/');
    expect(stillOnAdmin).toBe(false);
  });
});

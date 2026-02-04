import { test, expect } from '@playwright/test';

/**
 * E2E: Health check (Supabase Edge Function "health" or Vercel /api/health).
 * Skips if VITE_SUPABASE_URL and SUPABASE_URL are not set.
 * Uses fallback: VITE_SUPABASE_URL || SUPABASE_URL.
 */
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:8080';

test.describe('Health Check', () => {
  test.skip(!supabaseUrl, 'VITE_SUPABASE_URL or SUPABASE_URL not set');

  test('health edge function returns 200 and ok when DB/schema/storage are ready', async ({ request }) => {
    const healthUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/health`;
    const response = await request.get(healthUrl, {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''}`,
      },
    });
    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty('ok');
    expect(body).toHaveProperty('ts');
    if (body.ok === true) {
      expect(body.db).toBe(true);
      expect(body).toHaveProperty('schema');
      expect(body).toHaveProperty('storage');
    }
  });

  test('Vercel /api/health returns JSON with 200 or 503 (only when not localhost)', async ({ request }) => {
    const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl);
    test.skip(isLocal, 'Skip /api/health on localhost (API only on Vercel)');
    const apiHealthUrl = `${baseUrl.replace(/\/$/, '')}/api/health`;
    const response = await request.get(apiHealthUrl, { timeout: 10000 });
    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty('ok');
    expect(body).toHaveProperty('ts');
  });
});

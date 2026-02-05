import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E: Dashboard chat — clic "Scan document" → redirect a /scan → camera → nome pratica → pipeline → pratica creata.
 * Richiede utente autenticato (TEST_USER).
 */
const TEST_IMAGE = path.join(process.cwd(), 'src', 'assets', 'process-icons-1-2.jpeg');

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@lexora-test.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
};

test.describe('Dashboard: Scan document flow (camera on /scan)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /login|anmelden|accedi/i }).click();
    await page.waitForURL(/\/(app|dashboard)/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
  });

  test('Dashboard → Scan document → /scan → camera → name → document generated and redirect to pratica', async ({ page }) => {
    test.setTimeout(180000); // pipeline can take ~90s
    await page.goto('/app');
    await page.waitForLoadState('networkidle');

    // If still on login, auth failed — skip with clear message
    if (page.url().toLowerCase().includes('/login') || page.url().toLowerCase().includes('/auth')) {
      test.skip(true, 'Login failed or no TEST_USER_EMAIL/TEST_USER_PASSWORD — cannot test dashboard flow');
    }

    // In dashboard chat, click "Scan document" (camera button)
    const scanBtn = page.getByTestId('dashboard-scan-document-btn');
    await expect(scanBtn).toBeVisible({ timeout: 15000 });
    await scanBtn.click();

    // Should navigate to /scan
    await expect(page).toHaveURL(/\/scan/, { timeout: 10000 });

    // On /scan: click camera card to open InAppCamera (logged-in only)
    const cameraCard = page.getByTestId('scan-page-open-camera');
    await expect(cameraCard).toBeVisible({ timeout: 10000 });
    await cameraCard.click();

    // InAppCamera opens: E2E file input appears
    const cameraFileInput = page.getByTestId('camera-test-file-input');
    await expect(cameraFileInput).toBeAttached({ timeout: 10000 });

    // Simulate photo
    await cameraFileInput.setInputFiles(TEST_IMAGE);

    // Camera closes (modal unmounts)
    await expect(cameraFileInput).not.toBeAttached({ timeout: 8000 });

    // Name input form appears (showNameInput) — fill case name and continue
    const nameInput = page.getByLabel(/name|titolo|titel/i).or(page.locator('#pratica-name')).first();
    await expect(nameInput).toBeVisible({ timeout: 8000 });
    await nameInput.fill('E2E Dashboard Scan ' + Date.now());

    const continueBtn = page.getByRole('button', { name: /continue|continua|weiter|fortfahren/i }).first();
    await expect(continueBtn).toBeVisible({ timeout: 3000 });
    await continueBtn.click();

    // Pipeline runs: either we see loader then redirect to /pratiche/:id, or direct redirect
    await expect(page).toHaveURL(/\/pratiche\/[a-f0-9-]+/i, { timeout: 120000 });
  });
});

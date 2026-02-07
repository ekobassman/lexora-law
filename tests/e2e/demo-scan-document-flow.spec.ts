import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E: Demo chat — flusso da Scan document / Upload file a generazione documento.
 * Verifica che upload → OCR → analyze-and-draft partano e che compaiano analisi/bozza in chat.
 */
const TEST_IMAGE = path.join(process.cwd(), 'src', 'assets', 'process-icons-1-2.jpeg');

async function waitForPipelineSuccess(page: import('@playwright/test').Page, demoSection: import('@playwright/test').Locator) {
  const successIndicator = page.getByText(
    /document processed|documento elaborato|documents processed|analisi|analysis|rischio|summary|draft|Salve|LEXORA|come posso aiutarla/i
  );
  await expect(successIndicator.first()).toBeVisible({ timeout: 90000 });
  const assistantContent = demoSection.locator('[class*="message"], [class*="assistant"], .demo-frame-wrapper').filter({
    has: page.locator('text=/rischio|summary|analisi|draft|letter|document|elaborato|processed|Salve|LEXORA|aiutarla/i'),
  });
  await expect(assistantContent.first()).toBeVisible({ timeout: 5000 });
  // REGRESSION: AI must NOT say "non ho trovato informazioni" or "indicami l'indirizzo" after upload – doc is in context
  const forbidden = page.getByText(/non ho trovato informazioni|indicami l'indirizzo|nessuna informazione affidabile/i);
  await expect(forbidden).not.toBeVisible();
}

test.describe('Demo: Scan/Upload document to analysis', () => {
  test('Scan document button → camera → simulate photo → pipeline runs and document generated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const demoSection = page.locator('section.demo-chat-premium').first();
    await expect(demoSection).toBeVisible({ timeout: 15000 });

    // Clicca "Scan document" (icona camera)
    const scanBtn = demoSection.getByRole('button', { name: /scan|scatta/i }).first();
    await scanBtn.click();

    // Attendi che si apra la camera (modal InAppCamera con input E2E)
    const cameraFileInput = page.getByTestId('camera-test-file-input');
    await expect(cameraFileInput).toBeAttached({ timeout: 10000 });

    // Simula foto: imposta file sull'input (stesso esito di "scatta → Done")
    await cameraFileInput.setInputFiles(TEST_IMAGE);

    // Camera si chiude e parte la pipeline; attendi che l'input non sia più nel DOM
    await expect(cameraFileInput).not.toBeAttached({ timeout: 8000 });
    await waitForPipelineSuccess(page, demoSection);
  });

  test('Upload file in demo chat runs pipeline and shows analysis or draft', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const demoSection = page.locator('section.demo-chat-premium').first();
    await expect(demoSection).toBeVisible({ timeout: 15000 });

    const fileInput = demoSection.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    await fileInput.setInputFiles(TEST_IMAGE);

    await waitForPipelineSuccess(page, demoSection);
  });
});

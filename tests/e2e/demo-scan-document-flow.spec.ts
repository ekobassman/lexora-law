import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * E2E: Demo chat — flusso da upload foto a generazione documento.
 * Simula "Scan document" / "Upload file" con un'immagine e verifica che
 * partano upload → OCR → analyze-and-draft e che compaiano analisi/bozza in chat.
 */
const TEST_IMAGE = path.join(process.cwd(), 'src', 'assets', 'process-icons-1-2.jpeg');

test.describe('Demo: Scan/Upload document to analysis', () => {
  test('upload image in demo chat runs pipeline and shows analysis or draft', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Trova la sezione demo chat (homepage)
    const demoSection = page.locator('section.demo-chat-premium').first();
    await expect(demoSection).toBeVisible({ timeout: 15000 });

    // File input nascosto nella demo
    const fileInput = demoSection.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    // Carica l'immagine (simula "Upload file" con un file)
    await fileInput.setInputFiles(TEST_IMAGE);

    // Attendi che la pipeline completi: toast di successo o messaggio assistente con analisi/bozza
    const successIndicator = page.getByText(
      /document processed|documento elaborato|documents processed|analisi|analysis|rischio|summary|draft/i
    );
    await expect(successIndicator.first()).toBeVisible({ timeout: 90000 });

    // Verifica che in chat ci sia almeno un messaggio assistente (analisi o risposta)
    const assistantContent = demoSection.locator('[class*="message"], [class*="assistant"], .demo-frame-wrapper').filter({
      has: page.locator('text=/rischio|summary|analisi|draft|letter|document|elaborato|processed/i'),
    });
    await expect(assistantContent.first()).toBeVisible({ timeout: 5000 });
  });
});

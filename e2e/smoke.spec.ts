import { expect, test } from '@playwright/test';

test('ouvre l’administration locale', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Tafaron' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer la partie' })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-home.png', fullPage: true });
});

import { expect, test, createViaUI, unlockViaUI } from './helpers';
import { fileURLToPath } from 'node:url';

test('automatic theme follows the device while manual theme stays selected', async ({ vaultPage: page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await createViaUI(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByTestId('button-settings').click();
  await page.getByTestId('select-theme-mode').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByTestId('select-theme-mode').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByTestId('select-theme-mode').selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await unlockViaUI(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('company logo can be uploaded, persists through reload, and can be removed', async ({ vaultPage: page }) => {
  await createViaUI(page);
  await page.getByTestId('button-settings').click();
  await page.getByTestId('input-brand-logo').setInputFiles(fileURLToPath(
    new URL('../../../../docs/images/app-02-first-launch.jpg', import.meta.url),
  ));
  const preview = page.locator('.brand-preview img');
  await expect(preview).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  await expect(page.locator('.topbar .brand-logo')).toHaveAttribute('alt', 'Company brand logo');

  // The encrypted vault write is asynchronous; wait for it before simulating reload.
  await page.waitForFunction(async () => {
    const request = indexedDB.open('social-watch-private', 1);
    const envelope = await new Promise<any>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('vault', 'readonly');
        const read = tx.objectStore('vault').get('profile');
        tx.oncomplete = () => { db.close(); resolve(read.result); };
      };
    });
    const cryptoPath: string = '/src/core/crypto.ts';
    const { decrypt } = await import(cryptoPath);
    const profile = await decrypt(envelope, 'synthetic vault regression phrase');
    return profile.data.settings.brandLogo?.startsWith('data:image/jpeg;base64,');
  });

  await page.reload();
  await unlockViaUI(page);
  await expect(page.locator('.topbar .brand-logo')).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
  await page.getByTestId('button-settings').click();
  await page.getByTestId('tab-accounts').click();
  await expect(page.getByTestId('button-connect').locator('.platform-logo-facebook')).toHaveCount(1);
  await page.getByTestId('tab-general').click();
  await page.getByTestId('button-remove-brand-logo').click();
  await expect(page.getByTestId('button-choose-brand-logo')).toHaveText(/Upload logo/);
  await expect(page.locator('.topbar .brand-logo')).toHaveCount(0);
});

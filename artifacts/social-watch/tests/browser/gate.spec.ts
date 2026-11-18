import { test, expect, createViaUI, unlockViaUI, persistedIdle } from './helpers';

test('wrong passphrase stays locked; saved settings survive reload; confirmed wipe removes them', async ({ vaultPage: page }) => {
  await createViaUI(page);
  await page.getByTestId('button-settings').click();
  await page.getByTestId('input-idle').fill('23');
  await page.getByTestId('button-save-settings').click();
  // A lock/reload alone could cancel the pending save: observe its committed value first.
  await expect.poll(() => persistedIdle(page)).toBe(23);
  await page.keyboard.press('Escape');
  await page.getByTestId('button-lock').click();
  await unlockViaUI(page, 'wrong synthetic passphrase');
  await expect(page.getByRole('alert')).toHaveText('That passphrase did not open the vault.');
  await expect(page.getByTestId('input-passphrase')).toHaveValue('');
  await expect(page.getByTestId('button-lock')).toHaveCount(0);
  await unlockViaUI(page);
  await expect(page.getByTestId('button-lock')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Unlock your desk' })).toBeVisible();
  await unlockViaUI(page);
  await page.getByTestId('button-settings').click();
  await expect(page.getByTestId('input-idle')).toHaveValue('23');
  await page.keyboard.press('Escape');
  await page.getByTestId('button-lock').click();
  await page.getByTestId('button-forgot').click();
  const wipe = page.getByRole('button', { name: 'Wipe everything', exact: true });
  await expect(wipe).toBeDisabled();
  await page.getByTestId('input-confirm-text').fill('WIPE');
  await wipe.click();
  await expect(page.getByRole('heading', { name: 'Set a passphrase' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Set a passphrase' })).toBeVisible();
});

for (const failure of ['throw', 'error', 'blocked'] as const) {
  test(`unavailable storage (${failure}) is visible before and after create attempt`, async ({ vaultPage: page }) => {
    // Pause loading the vault module until the browser fault is installed.
    await page.route('**/src/core/vault.ts*', async route => {
      await page.evaluate(failure => { window.vaultFaults.open = failure; }, failure);
      await route.continue();
    });
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Device storage is unavailable');
    await page.getByTestId('input-passphrase').fill('synthetic vault regression phrase');
    await page.getByTestId('input-passphrase-confirm').fill('synthetic vault regression phrase');
    await page.getByTestId('button-gate-submit').click();
    await expect(page.getByTestId('text-gate-error')).toContainText('Could not create');
    await expect(page.getByTestId('button-gate-submit')).toBeDisabled();
    await expect(page.getByTestId('button-lock')).toHaveCount(0);
  });
}

test('aborted writes show an error, preserve the old record, and Retry save persists the change', async ({ vaultPage: page }) => {
  await createViaUI(page);
  await page.evaluate(() => { window.vaultFaults.write = true; });
  await page.getByTestId('button-settings').click();
  await page.getByTestId('input-idle').fill('29');
  await page.getByTestId('button-save-settings').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alert')).toContainText('Changes could not be saved to the encrypted vault');
  await expect(page.getByRole('alert')).toContainText('not saved');
  expect(await persistedIdle(page)).toBe(15);
  await page.evaluate(() => { window.vaultFaults.write = false; });
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await unlockViaUI(page);
  await page.getByTestId('button-settings').click();
  await expect(page.getByTestId('input-idle')).toHaveValue('29');
});

test('failed wipe is visible while locked and leaves the vault recoverable', async ({ vaultPage: page }) => {
  await createViaUI(page);
  await page.getByTestId('button-lock').click();
  await page.evaluate(() => { window.vaultFaults.clear = true; });
  await page.getByTestId('button-forgot').click();
  await page.getByTestId('input-confirm-text').fill('WIPE');
  await page.getByRole('button', { name: 'Wipe everything', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Wipe failed');
  await expect(page.getByRole('heading', { name: 'Unlock your desk' })).toBeVisible();
  await unlockViaUI(page);
  await expect(page.getByTestId('button-lock')).toBeVisible();
});

test('aborted creation never unlocks and can be retried safely', async ({ vaultPage: page }) => {
  await page.evaluate(() => { window.vaultFaults.write = true; });
  await page.getByTestId('input-passphrase').fill('synthetic vault regression phrase');
  await page.getByTestId('input-passphrase-confirm').fill('synthetic vault regression phrase');
  await page.getByTestId('button-gate-submit').click();
  await expect(page.getByRole('alert')).toContainText('Could not create');
  await expect(page.getByTestId('button-lock')).toHaveCount(0);
  await page.evaluate(() => { window.vaultFaults.write = false; });
  await createViaUI(page);
});

test('locking cancels pending UI saves without leaking errors into the next session', async ({ vaultPage: page }) => {
  await createViaUI(page);
  await page.evaluate(() => { window.vaultFaults.pause = 'encrypt'; });
  await page.getByTestId('button-settings').click();
  await page.getByTestId('input-idle').fill('31');
  await page.getByTestId('button-save-settings').click();
  await expect.poll(() => page.evaluate(() => window.vaultFaults.waiting)).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByTestId('button-lock').click();
  await expect(page.getByRole('heading', { name: 'Unlock your desk' })).toBeVisible();
  // Unlock while the previous session's save is still awaiting encryption.
  await unlockViaUI(page);
  await expect(page.getByTestId('button-lock')).toBeVisible();
  await page.evaluate(() => window.vaultFaults.release());
  // Drain the real queue so the absence of an alert isn't a timing assertion.
  await page.evaluate(async pass => {
    const path = '/src/core/vault.ts';
    const v = await import(path) as typeof import('../../src/core/vault');
    await v.saveProfile(await v.unlockVault(pass));
  }, 'synthetic vault regression phrase');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByTestId('button-settings').click();
  await expect(page.getByTestId('input-idle')).toHaveValue('15');
});

test('failed wipe from Settings locks the desk and shows a recoverable error', async ({ vaultPage: page }) => {
  await createViaUI(page);
  await page.evaluate(() => { window.vaultFaults.clear = true; });
  await page.getByTestId('button-settings').click();
  await page.getByRole('tab', { name: 'Data & privacy' }).click();
  await page.getByRole('button', { name: 'Wipe all data', exact: true }).click();
  await page.getByTestId('input-confirm-text').fill('WIPE');
  await page.getByTestId('button-confirm').click();
  await expect(page.getByRole('alert')).toContainText('Wipe failed');
  await expect(page.getByTestId('button-lock')).toHaveCount(0);
  await unlockViaUI(page);
  await expect(page.getByTestId('button-lock')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

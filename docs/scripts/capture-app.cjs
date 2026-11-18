/**
 * Documentation captures only. Uses a disposable browser profile and the normal
 * create-vault / Try demo UI; never connects to Meta or changes production code.
 * Run from the repository root with the existing dev workflow running:
 * node docs/scripts/capture-app.cjs
 * Optional: DOCS_BASE_URL=http://localhost:5173 CHROMIUM_PATH=/path/to/chromium
 */
const { chromium } = require('../../artifacts/social-watch/node_modules/@playwright/test');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const output = path.resolve('docs/images');
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium',
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 }, colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  // No external account requests or media are needed for documentation.
  await page.route('https://graph.**/*', route => route.abort());
  const shot = async name => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(output, `${name}.jpg`), quality: 86, animations: 'disabled' });
    console.log(`Captured ${name}`);
  };
  try {
    await page.goto(process.env.DOCS_BASE_URL || 'http://127.0.0.1:80/', { waitUntil: 'networkidle' });
    await page.getByTestId('input-passphrase-confirm').waitFor();
    await shot('app-01-create-vault');
    // Synthetic throwaway phrase, not a real credential; context is discarded.
    const phrase = 'Documentation sample vault only 2026';
    await page.getByTestId('input-passphrase').fill(phrase);
    await page.getByTestId('input-passphrase-confirm').fill(phrase);
    await page.getByTestId('button-gate-submit').click();
    await page.getByTestId('button-demo').waitFor();
    await shot('app-02-first-launch');
    await page.getByTestId('button-demo').click();
    await page.getByTestId('status-demo').waitFor();
    await shot('app-03-desktop-demo');
    await page.getByTestId('button-reply-demo-c1').first().click();
    await page.getByTestId('input-reply-demo-c1').first().fill('Thanks for checking! Please speak to our team about allergens before ordering.');
    await shot('app-04-reply');
    await page.keyboard.press('Escape');
    await page.getByTestId('button-settings').click();
    await page.getByTestId('tab-general').waitFor();
    await shot('app-05-general-settings');
    await page.getByTestId('select-theme-mode').selectOption('dark');
    await shot('app-11-dark-theme');
    await page.getByTestId('select-theme-mode').selectOption('system');
    await page.getByTestId('tab-accounts').click();
    await shot('app-06-account-setup');
    await page.getByTestId('tab-watchlist').click();
    for (const term of ['allergy', 'refund', 'giveaway']) {
      await page.getByTestId('input-watch-term').fill(term);
      await page.getByTestId('button-add-term').click();
    }
    await page.getByTestId('tab-notifications').click();
    await shot('app-07-notifications');
    await page.keyboard.press('Escape');
    await shot('app-08-watchlist');
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('app-09-mobile-demo');
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.locator('.deck').evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await page.waitForTimeout(400);
    await shot('app-10-launch-tiles');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

import { test as base, expect, type Page } from '@playwright/test';

export const PASSPHRASE = 'synthetic vault regression phrase';

// Browser API faults live only in isolated Playwright contexts, never in app code.
declare global {
  interface Window {
    vaultFaults: {
      write: boolean;
      clear: boolean;
      open: 'none' | 'throw' | 'error' | 'blocked';
      pause: 'none' | 'encrypt' | 'open';
      waiting: boolean;
      release: () => void;
    };
  }
}

export const test = base.extend<{ vaultPage: Page }>({
  vaultPage: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // No real Meta traffic, even if a future default accidentally tries to connect.
    await page.route(/https:\/\/.*(?:facebook|instagram)\.com\//, route => route.abort());
    await page.addInitScript(() => {
      const faults: Window['vaultFaults'] = {
        write: false, clear: false, open: 'none', pause: 'none',
        waiting: false, release: () => {},
      };
      window.vaultFaults = faults;
      const open = IDBFactory.prototype.open;
      IDBFactory.prototype.open = function (...args) {
        if (faults.open === 'throw') throw new DOMException('Storage denied', 'SecurityError');
        if (faults.open === 'error' || faults.open === 'blocked') {
          const request = new EventTarget() as IDBOpenDBRequest;
          queueMicrotask(() => {
            const event = new Event(faults.open);
            if (event.type === 'error') request.onerror?.call(request, event);
            else request.onblocked?.call(request, event as IDBVersionChangeEvent);
          });
          return request;
        }
        const request = open.apply(this, args);
        if (faults.pause === 'open') {
          faults.pause = 'none';
          request.addEventListener('success', event => {
            event.stopImmediatePropagation();
            faults.waiting = true;
            faults.release = () => {
              faults.waiting = false;
              request.dispatchEvent(new Event('success'));
            };
          }, { once: true });
        }
        return request;
      };
      const put = IDBObjectStore.prototype.put;
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) {
        const result = add.apply(this, args);
        if (faults.write) this.transaction.abort();
        return result;
      };
      IDBObjectStore.prototype.put = function (...args) {
        const result = put.apply(this, args);
        if (faults.write) this.transaction.abort();
        return result;
      };
      const clear = IDBObjectStore.prototype.clear;
      IDBObjectStore.prototype.clear = function () {
        const result = clear.call(this);
        if (faults.clear) this.transaction.abort();
        return result;
      };
      const encrypt = crypto.subtle.encrypt.bind(crypto.subtle);
      crypto.subtle.encrypt = async (...args) => {
        if (faults.pause === 'encrypt') {
          faults.pause = 'none';
          faults.waiting = true;
          await new Promise<void>(resolve => {
            faults.release = () => { faults.waiting = false; resolve(); };
          });
        }
        return encrypt(...args);
      };
    });
    await page.goto('./');
    await expect(page.getByTestId('form-gate')).toBeVisible();
    await use(page);
    expect(errors, 'No unhandled browser errors').toEqual([]);
  },
});

export async function createViaUI(page: Page) {
  await page.getByTestId('input-passphrase').fill(PASSPHRASE);
  await page.getByTestId('input-passphrase-confirm').fill(PASSPHRASE);
  await page.getByTestId('button-gate-submit').click();
  await expect(page.getByTestId('button-lock')).toBeVisible();
}

export async function unlockViaUI(page: Page, passphrase = PASSPHRASE) {
  await page.getByTestId('input-passphrase').fill(passphrase);
  await page.getByTestId('button-gate-submit').click();
}

export async function persistedIdle(page: Page): Promise<number> {
  return page.evaluate(async pass => {
    const envelope = await new Promise(resolve => {
      const request = indexedDB.open('social-watch-private', 1);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('vault');
        const read = tx.objectStore('vault').get('profile');
        tx.oncomplete = () => { db.close(); resolve(read.result); };
      };
    });
    const path = '/src/core/crypto.ts';
    const { decrypt } = await import(path) as typeof import('../../src/core/crypto');
    const p = (await decrypt(envelope, pass)).data as { settings: { idleMinutes: number } };
    return p.settings.idleMinutes;
  }, PASSPHRASE);
}

export { expect };

import { test, expect, PASSPHRASE } from './helpers';

// Load the real vault module through Vite in a real browser: native WebCrypto and
// IndexedDB, no in-memory database substitute and no production unlock shortcut.
test('encrypted create/save/lock/reload/unlock/wipe lifecycle', async ({ vaultPage: page }) => {
  const result = await page.evaluate(async pass => {
    const vaultPath = '/src/core/vault.ts', typesPath = '/src/core/types.ts';
    const v = await import(vaultPath) as typeof import('../../src/core/vault');
    const { defaultProfile } = await import(typesPath) as typeof import('../../src/core/types');
    const profile = defaultProfile();
    profile.watchlist = ['synthetic-private-marker'];
    const absent = await v.hasVault();
    await v.createVault(pass, profile);
    const exists = await v.hasVault();
    const readEnvelope = () => new Promise<Record<string, unknown>>(resolve => {
      const request = indexedDB.open('social-watch-private', 1);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('vault');
        const read = tx.objectStore('vault').get('profile');
        tx.oncomplete = () => { db.close(); resolve(read.result); };
      };
    });
    const first = await readEnvelope();
    profile.settings.idleMinutes = 23;
    await v.saveProfile(profile);
    const second = await readEnvelope();
    v.lockVault();
    const locked = await v.saveProfile(profile).then(() => '', e => e.message);
    const wrong = await v.unlockVault('wrong synthetic passphrase').then(() => '', e => e.message);
    const stillLocked = await v.saveProfile(profile).then(() => '', e => e.message);
    const recovered = await v.unlockVault(pass);
    return { absent, exists, first, second, locked, wrong, stillLocked, recovered };
  }, PASSPHRASE);
  expect(result.absent).toBe(false);
  expect(result.exists).toBe(true);
  expect(result.first).toMatchObject({ format: 'social-watch', iterations: 600000 });
  expect(Object.keys(result.first).sort()).toEqual(['ciphertext', 'format', 'iterations', 'iv', 'kdf', 'salt', 'version']);
  expect(JSON.stringify(result.second)).not.toContain('synthetic-private-marker');
  expect(JSON.stringify(result.second)).not.toContain(PASSPHRASE);
  expect(result.second.iv).not.toBe(result.first.iv);
  expect(result.second.salt).toBe(result.first.salt);
  expect(result.second.ciphertext).not.toBe(result.first.ciphertext);
  expect(result.locked).toMatch(/locked/);
  expect(result.wrong).toMatch(/Incorrect passphrase/);
  expect(result.stillLocked).toMatch(/locked/);
  expect(result.recovered.settings.idleMinutes).toBe(23);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Unlock your desk' })).toBeVisible();
  const wiped = await page.evaluate(async pass => {
    const path = '/src/core/vault.ts';
    const v = await import(path) as typeof import('../../src/core/vault');
    const p = await v.unlockVault(pass);
    sessionStorage.setItem('social-watch-oauth', 'synthetic-nonce');
    await v.wipeVault();
    return {
      exists: await v.hasVault(),
      nonce: sessionStorage.getItem('social-watch-oauth'),
      save: await v.saveProfile(p).then(() => '', e => e.message),
      unlock: await v.unlockVault(pass).then(() => '', e => e.message),
    };
  }, PASSPHRASE);
  expect(wiped).toMatchObject({ exists: false, nonce: null });
  expect(wiped.save).toMatch(/locked/);
  expect(wiped.unlock).toMatch(/No profile/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Set a passphrase' })).toBeVisible();
});

test('queued saves are ordered snapshots and recover after an aborted write', async ({ vaultPage: page }) => {
  const result = await page.evaluate(async pass => {
    const path = '/src/core/vault.ts', types = '/src/core/types.ts';
    const v = await import(path) as typeof import('../../src/core/vault');
    const { defaultProfile } = await import(types) as typeof import('../../src/core/types');
    const p = defaultProfile();
    await v.createVault(pass, p);
    window.vaultFaults.pause = 'encrypt';
    p.watchlist = ['first'];
    const first = v.saveProfile(p);
    p.watchlist = ['second'];
    const second = v.saveProfile(p);
    p.watchlist = ['mutated-after-queue'];
    while (!window.vaultFaults.waiting) await new Promise(r => setTimeout(r, 0));
    window.vaultFaults.release();
    await Promise.all([first, second]);
    const queued = await v.unlockVault(pass);
    window.vaultFaults.write = true;
    const failure = await v.saveProfile(p).then(() => '', e => e.message);
    const unchanged = await v.unlockVault(pass);
    window.vaultFaults.write = false;
    p.watchlist = ['recovered'];
    await v.saveProfile(p);
    return { queued, failure, unchanged, recovered: await v.unlockVault(pass) };
  }, PASSPHRASE);
  expect(result.queued.watchlist).toEqual(['second']);
  expect(result.failure).toMatch(/not saved/);
  expect(result.unchanged.watchlist).toEqual(['second']);
  expect(result.recovered.watchlist).toEqual(['recovered']);
});

for (const pause of ['encrypt', 'open'] as const) {
  for (const action of ['lock', 'wipe'] as const) {
    test(`${action} invalidates running and queued saves paused at ${pause}`, async ({ vaultPage: page }) => {
      const result = await page.evaluate(async ({ pass, pause, action }) => {
        const path = '/src/core/vault.ts', types = '/src/core/types.ts';
        const v = await import(path) as typeof import('../../src/core/vault');
        const { defaultProfile } = await import(types) as typeof import('../../src/core/types');
        const p = defaultProfile();
        await v.createVault(pass, p);
        window.vaultFaults.pause = pause;
        p.watchlist = ['must-not-persist'];
        const first = v.saveProfile(p).then(() => 'saved', e => e.message);
        const second = v.saveProfile(p).then(() => 'saved', e => e.message);
        while (!window.vaultFaults.waiting) await new Promise(r => setTimeout(r, 0));
        const wiped = action === 'wipe' ? v.wipeVault() : (v.lockVault(), Promise.resolve());
        window.vaultFaults.release();
        const saves = await Promise.all([first, second]);
        await wiped;
        const exists = await v.hasVault();
        const data = exists ? await v.unlockVault(pass) : null;
        return { saves, exists, data };
      }, { pass: PASSPHRASE, pause, action });
      expect(result.saves).toEqual([
        'Profile locked before changes could be saved.',
        'Profile locked before changes could be saved.',
      ]);
      expect(result.exists).toBe(action !== 'wipe');
      if (result.data) expect(result.data.watchlist).toEqual([]);
    });
  }
}

test('two concurrent creates cannot overwrite an existing profile', async ({ vaultPage: page }) => {
  const result = await page.evaluate(async pass => {
    const path = '/src/core/vault.ts', types = '/src/core/types.ts';
    const v = await import(path) as typeof import('../../src/core/vault');
    const { defaultProfile } = await import(types) as typeof import('../../src/core/types');
    const a = defaultProfile(), b = defaultProfile();
    a.watchlist = ['first']; b.watchlist = ['second'];
    const results = await Promise.allSettled([v.createVault(pass, a), v.createVault(pass, b)]);
    const winner = results.findIndex(r => r.status === 'fulfilled');
    const stored = await v.unlockVault(pass);
    const duplicate = await v.createVault(pass, defaultProfile()).then(() => '', e => e.message);
    return { statuses: results.map(r => r.status), winner, stored, duplicate };
  }, PASSPHRASE);
  expect(result.statuses.filter(s => s === 'fulfilled')).toHaveLength(1);
  expect(result.stored.watchlist).toEqual([result.winner === 0 ? 'first' : 'second']);
  expect(result.duplicate).toMatch(/already exists/);
});

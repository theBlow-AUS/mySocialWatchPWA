import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decrypt, encrypt, encryptWithKey, parseEnvelope } from '../src/core/crypto.ts';
import { defaultProfile } from '../src/core/types.ts';
import { decodeProfile, encodeProfile } from '../src/core/profile-transfer.ts';

const pass = 'twelve unrelated words are not needed here';
test('AES-GCM encrypts and round-trips data with PBKDF2-SHA256 600000', async () => {
  const data = { private: 'never plaintext', nested: ['ü', '日本語'] };
  const { envelope, key } = await encrypt(data, pass);
  assert.equal(envelope.iterations, 600000);
  assert.equal(envelope.kdf, 'PBKDF2-SHA256');
  assert.equal(key.extractable, false);
  assert.equal(JSON.stringify(envelope).includes('never plaintext'), false);
  assert.deepEqual((await decrypt(envelope, pass)).data, data);
});
test('each encryption uses random salt and IV', async () => {
  const a = await encrypt('same', pass), b = await encrypt('same', pass);
  assert.notEqual(a.envelope.salt, b.envelope.salt);
  assert.notEqual(a.envelope.iv, b.envelope.iv);
  const next = await encryptWithKey('same', a.key, a.envelope.salt);
  assert.notEqual(next.iv, a.envelope.iv);
});
test('wrong passphrases do not decrypt', async () => {
  const { envelope } = await encrypt('secret', pass);
  await assert.rejects(decrypt(envelope, 'wrong passphrase here'), /Incorrect passphrase/);
});
test('tampered ciphertext and metadata are rejected', async () => {
  const { envelope } = await encrypt('secret', pass);
  const bytes = Buffer.from(envelope.ciphertext, 'base64'); bytes[0] ^= 1;
  await assert.rejects(decrypt({ ...envelope, ciphertext: bytes.toString('base64') }, pass));
  assert.throws(() => parseEnvelope({ ...envelope, iterations: 1 }));
  assert.throws(() => parseEnvelope({ ...envelope, version: 2 }));
  assert.throws(() => parseEnvelope({ ...envelope, iv: 'bad' }));
});
test('weak export passphrases are rejected', async () => {
  await assert.rejects(encrypt({}, 'short'), /12 characters/);
});
test('profile export/import preserves settings and excludes credentials and account data', async () => {
  const profile = defaultProfile();
  profile.settings.appId = '123456789';
  profile.settings.theme = 'dark';
  profile.settings.brandLogo = 'data:image/png;base64,ZmFrZQ==';
  profile.watchlist = ['refund', 'allergy'];
  profile.accounts = [{ id: 'abc', name: 'Private account', platform: 'facebook', token: 'never-export-this', expiresAt: 123 }];
  profile.comments = [{ id: 'c1', accountId: 'abc', postId: 'p1', text: 'private comment', author: 'Person', createdAt: '', hidden: false, reviewed: true }];
  profile.columns[0].accountId = 'abc';
  const serialized = await encodeProfile(profile, pass);
  assert.equal(serialized.includes('never-export-this'), false);
  const result = await decodeProfile(serialized, pass);
  assert.deepEqual(result.settings, profile.settings);
  assert.deepEqual(result.watchlist, profile.watchlist);
  assert.deepEqual(result.accounts, []);
  assert.deepEqual(result.comments, []);
  assert.deepEqual(result.posts, []);
  assert.deepEqual(result.audit, []);
  assert.equal(result.columns[0].accountId, undefined);
});
test('profile import rejects malformed, wrong-passphrase and invalid-schema files', async () => {
  await assert.rejects(decodeProfile('not-json', pass));
  const good = await encodeProfile(defaultProfile(), pass);
  await assert.rejects(decodeProfile(good, 'incorrect passphrase'));
  const invalid = await encrypt({ version: 99 }, pass);
  await assert.rejects(decodeProfile(JSON.stringify(invalid.envelope), pass));
});
test('import rejects unsafe custom links even in authenticated profile files', async () => {
  const profile = defaultProfile();
  profile.tiles[0].url = 'javascript:alert(1)';
  const { envelope } = await encrypt(profile, pass);
  await assert.rejects(decodeProfile(JSON.stringify(envelope), pass));
});

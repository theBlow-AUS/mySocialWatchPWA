import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, ProfileSchema } from '../src/core/types.ts';

test('patched Zod accepts existing saved profiles without notification preferences', () => {
  const original = defaultProfile();
  assert.deepEqual(ProfileSchema.parse(JSON.parse(JSON.stringify(original))), original);
});

test('notification record validation preserves valid account preferences and rejects invalid values', () => {
  const profile = defaultProfile();
  profile.settings.notifications = {
    'account-123': { enabled: true, comments: true, replies: false, watchlistOnly: true },
  };
  assert.deepEqual(ProfileSchema.parse(profile), profile);
  const invalid = JSON.parse(JSON.stringify(profile));
  invalid.settings.notifications['account-123'].enabled = 'true';
  assert.equal(ProfileSchema.safeParse(invalid).success, false);
});

test('profile collection limits and unsafe-link validation remain enforced after the upgrade', () => {
  const profile = defaultProfile();
  profile.tiles = Array.from({ length: 101 }, (_, i) => ({
    id: String(i), title: 'Tile', url: 'https://example.test/', platform: 'custom' as const,
  }));
  assert.equal(ProfileSchema.safeParse(profile).success, false);
  profile.tiles = [{ id: 'bad', title: 'Unsafe', url: 'javascript:alert(1)', platform: 'custom' }];
  assert.equal(ProfileSchema.safeParse(profile).success, false);
});

test('theme modes include system while existing manual themes remain valid', () => {
  const profile = defaultProfile();
  assert.equal(profile.settings.theme, 'system');
  for (const theme of ['system', 'light', 'dark'] as const) {
    profile.settings.theme = theme;
    assert.equal(ProfileSchema.safeParse(profile).success, true);
  }
  profile.settings.theme = 'invalid' as typeof profile.settings.theme;
  assert.equal(ProfileSchema.safeParse(profile).success, false);
});

test('optional company logo accepts bounded raster image data only', () => {
  const profile = defaultProfile();
  for (const mime of ['png', 'jpeg', 'webp']) {
    profile.settings.brandLogo = `data:image/${mime};base64,AA==`;
    assert.equal(ProfileSchema.safeParse(profile).success, true);
  }
  profile.settings.brandLogo = 'data:image/svg+xml;base64,PHN2Zz4=';
  assert.equal(ProfileSchema.safeParse(profile).success, false);
  profile.settings.brandLogo = `data:image/png;base64,${'a'.repeat(1_500_000)}`;
  assert.equal(ProfileSchema.safeParse(profile).success, false);
});

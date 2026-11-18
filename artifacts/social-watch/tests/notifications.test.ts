import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRefresh, selectAlerts, showLocalNotification, notificationPermission } from '../src/core/notifications.ts';
import { defaultProfile, ProfileSchema, type Comment } from '../src/core/types.ts';
import { portableProfile } from '../src/core/profile-transfer.ts';

const makeProfile = () => {
  const p = defaultProfile();
  p.accounts = [
    { id: 'fb', name: 'Private Facebook Page', token: 'secret-token', expiresAt: 9999999999999, platform: 'facebook' },
    { id: 'ig', name: 'Private Instagram', token: 'secret-token', expiresAt: 9999999999999, platform: 'instagram' },
  ];
  p.settings.notifications = {
    fb: { enabled: true, comments: true, replies: false, watchlistOnly: false },
    ig: { enabled: false, comments: true, replies: true, watchlistOnly: false },
  };
  return p;
};
const comment = (change: Partial<Comment> = {}): Comment => ({
  id: 'c1', accountId: 'fb', postId: 'p1', author: 'Private author',
  text: 'Private comment, REFUND please', createdAt: '', hidden: false, reviewed: false, ...change,
});
test('old profiles remain opted out and inactive tabs do not refresh by default', () => {
  const p = ProfileSchema.parse(defaultProfile());
  assert.equal(p.settings.notifications, undefined);
  assert.equal(canRefresh(p, true, 200, 100), false);
  assert.equal(canRefresh(p, false, 200, 100), true);
});
test('inactive refresh requires explicit setting and never bypasses lock or idle expiry', () => {
  const p = makeProfile();
  p.settings.backgroundRefresh = true;
  assert.equal(canRefresh(p, true, 200, 100), true);
  assert.equal(canRefresh(p, true, 200, 200), false);
  assert.equal(canRefresh(p, false, 200, 201), false);
  assert.equal(canRefresh(null, true, 200, 100), false);
});
test('first account snapshot is silent', () => {
  assert.equal(selectAlerts(makeProfile(), [comment()], new Set()).size, 0);
});
test('new comments alert only for opted-in accounts, without duplicate IDs', () => {
  const p = makeProfile();
  const result = selectAlerts(p, [comment(), comment(), comment({ id: 'ig1', accountId: 'ig' })], new Set(['fb', 'ig']));
  assert.deepEqual([...result], [['fb', 1]]);
});
test('cached and reviewed comments do not alert', () => {
  const p = makeProfile();
  p.comments = [comment()];
  assert.equal(selectAlerts(p, [comment(), comment({ id: 'reviewed', reviewed: true })], new Set(['fb'])).size, 0);
});
test('comment and reply categories are independent', () => {
  const p = makeProfile();
  assert.equal(selectAlerts(p, [comment({ parentId: 'parent' })], new Set(['fb'])).size, 0);
  p.settings.notifications!.fb = { enabled: true, comments: false, replies: true, watchlistOnly: false };
  assert.equal(selectAlerts(p, [comment()], new Set(['fb'])).size, 0);
  assert.deepEqual([...selectAlerts(p, [comment({ parentId: 'parent' })], new Set(['fb']))], [['fb', 1]]);
});
test('watchlist filtering is case-insensitive and an empty watchlist matches nothing', () => {
  const p = makeProfile();
  p.settings.notifications!.fb.watchlistOnly = true;
  assert.equal(selectAlerts(p, [comment()], new Set(['fb'])).size, 0);
  p.watchlist = ['refund'];
  assert.deepEqual([...selectAlerts(p, [comment()], new Set(['fb']))], [['fb', 1]]);
  assert.equal(selectAlerts(p, [comment({ text: 'other message' })], new Set(['fb'])).size, 0);
});
test('removing an account or disabling notifications stops its alerts immediately', () => {
  const p = makeProfile();
  p.accounts = p.accounts.filter(a => a.id !== 'fb');
  assert.equal(selectAlerts(p, [comment()], new Set(['fb'])).size, 0);
  const q = makeProfile();
  q.settings.notifications!.fb.enabled = false;
  assert.equal(selectAlerts(q, [comment()], new Set(['fb'])).size, 0);
});
test('profile transfers cannot opt another device into account notifications', () => {
  const result = portableProfile(makeProfile());
  assert.deepEqual(result.settings.notifications, {});
  assert.deepEqual(result.accounts, []);
});
test('notification API absence is explicit, not a silent fallback', async () => {
  assert.equal(notificationPermission(), 'unsupported');
  await assert.rejects(showLocalNotification(1), /Allow browser notifications/);
});
test('local notifications redact account and comment data and recheck the session after awaiting the worker', async () => {
  const globals = ['Notification', 'navigator', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const shown: Array<[string, NotificationOptions]> = [];
  let allowed = true;
  Object.defineProperty(globalThis, 'Notification', { configurable: true, value: { permission: 'granted' } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { baseURI: 'https://example.test/repo/' } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: {
    getRegistration: async () => ({ active: true, showNotification: async (title: string, options: NotificationOptions) => { shown.push([title, options]); } }),
  } } });
  try {
    await showLocalNotification(3);
    assert.equal(shown.length, 1);
    assert.equal(shown[0][1].body, '3 new matching items. Open Social Watch to review.');
    assert.equal(JSON.stringify(shown).includes('Private'), false);
    assert.equal(shown[0][1].icon, 'https://example.test/repo/icon-192.png');
    const navigatorMock = globalThis.navigator;
    Object.defineProperty(navigatorMock.serviceWorker, 'getRegistration', { value: async () => {
      allowed = false;
      return { active: true, showNotification: async () => { throw new Error('Must not notify after locking'); } };
    } });
    await showLocalNotification(1, () => allowed);
    assert.equal(shown.length, 1);
  } finally {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

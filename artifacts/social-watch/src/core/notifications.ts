import type { Comment, Profile } from './types.ts';

/** Permission and preferences are separate. Old profiles are always opted out. */
export function canRefresh(profile: Profile | null, hidden: boolean, idleDeadline: number, now = Date.now()): boolean {
  return !!profile && (!idleDeadline || now < idleDeadline) &&
    (!hidden || !!profile.settings.backgroundRefresh);
}

/** Baseline each account once per unlock. Never announce imported/cached history. */
export function selectAlerts(profile: Profile, fetched: Comment[], baselined: Set<string>): Map<string, number> {
  const existing = new Set(profile.comments.map(c => `${c.accountId}:${c.id}`));
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const comment of fetched) {
    const key = `${comment.accountId}:${comment.id}`;
    const pref = profile.settings.notifications?.[comment.accountId];
    if (!baselined.has(comment.accountId) || !pref?.enabled || existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    if (comment.reviewed || (comment.parentId ? !pref.replies : !pref.comments)) continue;
    if (pref.watchlistOnly && !profile.watchlist.some(term => comment.text.toLocaleLowerCase().includes(term.toLocaleLowerCase()))) continue;
    if (!profile.accounts.some(a => a.id === comment.accountId)) continue;
    counts.set(comment.accountId, (counts.get(comment.accountId) || 0) + 1);
  }
  return counts;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') throw new Error('Notifications are unavailable here. On iPhone, try the installed Home Screen app.');
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked. Change permission in your browser or device settings.');
  // Call directly from a user's button click; never prompt on connect or refresh.
  return Notification.requestPermission();
}

/** Generic text only: never pass account names, authors, tokens or comment content to the OS. */
export async function showLocalNotification(count = 0, allowed = () => true): Promise<void> {
  if (notificationPermission() !== 'granted') throw new Error('Allow browser notifications first.');
  if (!allowed()) return;
  const title = count ? 'New Social Watch activity' : 'Social Watch test notification';
  const options: NotificationOptions = {
    body: count ? `${count} new matching item${count === 1 ? '' : 's'}. Open Social Watch to review.` : 'Local notifications are enabled on this device.',
    tag: count ? 'social-watch-activity' : 'social-watch-test',
    icon: new URL('icon-192.png', document.baseURI).href,
  };
  const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration(document.baseURI) : undefined;
  if (!allowed()) return;
  if (registration?.active) {
    await registration.showNotification(title, options);
    return;
  }
  // Desktop development fallback. Mobile browsers may require an installed worker.
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => { window.focus(); notification.close(); };
    setTimeout(() => notification.close(), 15000);
  } catch {
    throw new Error('This browser requires the installed production app for notifications. Install it, then test again.');
  }
}

export async function dismissLocalNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration(document.baseURI);
  if (registration) (await registration.getNotifications()).forEach(notification => notification.close());
}

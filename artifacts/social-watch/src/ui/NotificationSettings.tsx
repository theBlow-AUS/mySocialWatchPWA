import { useEffect, useState } from 'preact/hooks';
import type { NotificationPreference, Profile } from '../core/types';
import { notificationPermission, requestNotificationPermission, showLocalNotification } from '../core/notifications';
import { errMsg } from './util';
import { PlatformLogo } from './PlatformLogo';

const defaults: NotificationPreference = { enabled: false, comments: true, replies: true, watchlistOnly: false };
export function NotificationSettings({ profile, onUpdate }: {
  profile: Profile;
  onUpdate: (fn: (profile: Profile) => Profile) => void;
}) {
  const [permission, setPermission] = useState(notificationPermission());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const sync = () => setPermission(notificationPermission());
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);
  const allow = async () => {
    try {
      const result = await requestNotificationPermission();
      setPermission(result);
      setMessage(result === 'granted' ? 'Permission granted. Choose which accounts can alert below.' : 'Permission was not granted. You can change it in browser/device settings.');
    } catch (error) { setMessage(errMsg(error)); }
  };
  const setPref = (id: string, change: Partial<NotificationPreference>) => onUpdate(p => ({
    ...p, settings: { ...p.settings, notifications: {
      ...p.settings.notifications, [id]: { ...defaults, ...p.settings.notifications?.[id], ...change },
    } },
  }));
  return <div className="section">
    <h3>Inactive tabs & local notifications</h3>
    <p className="note">This stays fully static: no server and no push subscription. Browsers may slow or suspend inactive tabs. On iPhone, expect refresh only when the app is active. Closing the app or auto-locking stops monitoring. These are local notifications, not reliable background push.</p>
    <label className="row">
      <input type="checkbox" checked={!!profile.settings.backgroundRefresh} data-testid="input-background-refresh"
        onChange={e => onUpdate(p => ({ ...p, settings: {
          ...p.settings, backgroundRefresh: e.currentTarget.checked,
          refreshSeconds: e.currentTarget.checked && !p.settings.refreshSeconds ? 60 : p.settings.refreshSeconds,
        } }))} />
      <span>Try refreshing in inactive tabs while unlocked</span>
    </label>
    <small className="muted">Enabling this selects a 60-second interval if refresh is manual. Auto-lock remains {profile.settings.idleMinutes} minutes; monitoring never keeps your vault unlocked.</small>
    <div className="row">
      <span className="chip" role="status">Browser permission: {permission}</span>
      <button className="btn" onClick={() => void allow()} disabled={permission === 'unsupported' || permission === 'granted'}>Allow notifications</button>
      <button className="btn" disabled={permission !== 'granted' || busy} onClick={async () => {
        setBusy(true);
        try { await showLocalNotification(); setMessage('Test notification requested. Device Focus / Do Not Disturb settings may suppress it.'); }
        catch (error) { setMessage(errMsg(error)); }
        finally { setBusy(false); }
      }}>Send test notification</button>
    </div>
    {permission === 'denied' && <p className="err">Notifications are blocked. Allow them in this site's browser permissions or the installed app's device notification settings.</p>}
    {permission === 'unsupported' && <p className="muted">This browser does not expose notifications. On iPhone, install the production site using Add to Home Screen and check permission there. Installation does not enable background polling.</p>}
    {message && <p role="status">{message}</p>}
    <h3>Choose accounts and events</h3>
    <p className="muted">Accounts are off by default, including newly connected accounts. Alerts show a generic item count only, never comment text or account names. The first successful refresh after each unlock is a silent baseline; later new matches can alert while the tab is inactive.</p>
    {!profile.accounts.length && <p>Connect a Facebook Page or linked Instagram account to set its notification preferences.</p>}
    {(['facebook', 'instagram'] as const).map(platform => {
      const accounts = profile.accounts.filter(a => a.platform === platform);
      return accounts.length > 0 && <section className="section" key={platform}>
        <h3 className="platform-heading"><PlatformLogo platform={platform} size="small" />{platform === 'facebook' ? 'Facebook Pages' : 'Instagram'}</h3>
        {accounts.map(account => {
          const pref = { ...defaults, ...profile.settings.notifications?.[account.id] };
          return <fieldset className="section" key={account.id}>
            <legend>{account.name}</legend>
            <label className="row"><input type="checkbox" checked={pref.enabled} onChange={e => setPref(account.id, { enabled: e.currentTarget.checked })} />Notify for this account</label>
            <label className="row"><input type="checkbox" checked={pref.comments} disabled={!pref.enabled} onChange={e => setPref(account.id, { comments: e.currentTarget.checked })} />New comments</label>
            <label className="row"><input type="checkbox" checked={pref.replies} disabled={!pref.enabled} onChange={e => setPref(account.id, { replies: e.currentTarget.checked })} />New replies</label>
            <label className="row"><input type="checkbox" checked={pref.watchlistOnly} disabled={!pref.enabled} onChange={e => setPref(account.id, { watchlistOnly: e.currentTarget.checked })} />Only watchlist matches</label>
            {pref.enabled && !pref.comments && !pref.replies && <small>No event types selected; this account will not alert.</small>}
            {pref.enabled && pref.watchlistOnly && !profile.watchlist.length && <small>Add watchlist keywords first; no alerts match an empty watchlist.</small>}
          </fieldset>;
        })}
      </section>;
    })}
    <p className="note">LinkedIn and TikTok remain launch links, with no Social Watch event access or alerts. Configure their native notifications in those platforms. Account notification choices are encrypted on this device and excluded from profile transfers; opt in again on each device.</p>
  </div>;
}

import { useEffect, useRef, useState } from 'preact/hooks';
import { NotificationSettings } from './NotificationSettings';
import { Plug, RefreshCw, Trash2, X, Download, Upload, AlertTriangle, FlaskConical, ScrollText, Image } from 'lucide-react';
import type { Profile } from '../core/types';
import { exportProfile, importProfile, download } from '../core/vault';
import { Confirm, Dialog } from './Dialog';
import { ago, errMsg, val } from './util';
import { PlatformLogo, PlatformPill } from './PlatformLogo';

type Tab = 'general' | 'accounts' | 'watchlist' | 'notifications' | 'data';

interface SettingsProps {
  profile: Profile;
  demo: boolean;
  onClose: () => void;
  onUpdate: (fn: (p: Profile) => Profile) => void;
  onConnect: () => void;
  onDemo: (on: boolean) => void;
  onWipe: () => void;
  onAudit: () => void;
  initialTab?: Tab;
}

export function Settings(p: SettingsProps) {
  const [tab, setTab] = useState<Tab>(p.initialTab ?? 'general');
  const s = p.profile.settings;
  const [appId, setAppId] = useState(s.appId);
  const [apiVersion, setApiVersion] = useState(s.apiVersion);
  const [idle, setIdle] = useState(String(s.idleMinutes));
  const [refresh, setRefresh] = useState(String(s.refreshSeconds));
  useEffect(() => { setRefresh(String(s.refreshSeconds)); }, [s.refreshSeconds]);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [term, setTerm] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [wipe, setWipe] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState('');

  const saveGeneral = (e: Event) => {
    e.preventDefault();
    const idleN = Number(idle), refN = Number(refresh);
    if (appId && !/^\d{5,30}$/.test(appId.trim())) return setErr('A Meta App ID is a string of digits.');
    if (!/^v\d{1,3}\.\d{1,2}$/.test(apiVersion.trim())) return setErr('API version looks like v27.0.');
    if (!Number.isInteger(idleN) || idleN < 1 || idleN > 120) return setErr('Auto-lock must be 1 to 120 minutes.');
    if (!Number.isInteger(refN) || !(refN === 0 || (refN >= 60 && refN <= 3600))) return setErr('Interval must be 0 (manual) or 60 to 3600 seconds.');
    setErr('');
    p.onUpdate((x) => ({ ...x, settings: { ...x.settings, appId: appId.trim(), apiVersion: apiVersion.trim(), idleMinutes: idleN, refreshSeconds: refN } }));
    setSaved(true); setTimeout(() => setSaved(false), 1600);
  };

  const addTerm = (e: Event) => {
    e.preventDefault();
    const t = term.trim();
    if (!t || p.profile.watchlist.some((w) => w.toLowerCase() === t.toLowerCase())) return setTerm('');
    p.onUpdate((x) => ({ ...x, watchlist: [...x.watchlist, t.slice(0, 200)] }));
    setTerm('');
  };

  const chooseBrandLogo = (file?: File) => {
    setLogoError('');
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setLogoError('Choose a PNG, JPEG or WebP image.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setLogoError('The logo must be 1 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setLogoError('The logo could not be read. Try another image.');
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setLogoError('The logo could not be read. Try another image.');
        return;
      }
      p.onUpdate(profile => ({ ...profile, settings: { ...profile.settings, brandLogo: reader.result as string } }));
      setLogoError('');
    };
    reader.readAsDataURL(file);
  };

  const tabs: [Tab, string][] = [['general', 'General'], ['accounts', 'Accounts'], ['watchlist', 'Watchlist'], ['notifications', 'Notifications'], ['data', 'Data & privacy']];
  const now = Date.now();

  return (
    <Dialog title="Settings" onClose={p.onClose} wide id="settings"
      tabs={<div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`}>{l}</button>)}</div>}>
      {tab === 'general' && <form className="section" onSubmit={saveGeneral}>
        <h3>Brand appearance</h3>
        <div className="brand-settings">
          <div className="brand-preview" aria-label={s.brandLogo ? 'Uploaded company logo preview' : 'Default Social Watch logo'}>
            {s.brandLogo ? <img src={s.brandLogo} alt="Uploaded company brand logo" /> : <Image aria-hidden="true" />}
          </div>
          <div className="brand-settings-copy">
            <b>Company / brand logo</b>
            <small>Shown in the app header. PNG, JPEG or WebP, up to 1 MB. Saved in this device’s encrypted vault.</small>
            <div className="row">
              <input ref={logoInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose company logo" data-testid="input-brand-logo"
                onChange={e => { chooseBrandLogo(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
              <button className="btn sm" type="button" onClick={() => logoInput.current?.click()} data-testid="button-choose-brand-logo">
                <Upload /> {s.brandLogo ? 'Replace logo' : 'Upload logo'}
              </button>
              {s.brandLogo && <button className="btn sm" type="button" onClick={() => {
                p.onUpdate(profile => {
                  const { brandLogo: _brandLogo, ...settings } = profile.settings;
                  return { ...profile, settings };
                });
              }} data-testid="button-remove-brand-logo"><Trash2 /> Remove</button>}
            </div>
            {logoError && <span role="alert" className="err">{logoError}</span>}
          </div>
        </div>
        <label className="field theme-field"><span>Colour theme</span>
          <select className="select" value={s.theme} onChange={e => p.onUpdate(profile => ({
            ...profile, settings: { ...profile.settings, theme: val(e) as Profile['settings']['theme'] },
          }))} data-testid="select-theme-mode">
            <option value="system">Automatic — match device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <small>Automatic follows your device’s light/dark appearance setting.</small>
        </label>
        <h3>Meta app</h3>
        <div className="grid2">
          <label className="field"><span>Your Meta App ID</span><input className="input mono" inputMode="numeric" value={appId} onInput={(e) => setAppId(val(e))} placeholder="e.g. 1234567890123456" data-testid="input-app-id" />
            <small>From your own development-mode app. No app secret is ever needed here.</small></label>
          <label className="field"><span>Graph API version</span><input className="input mono" value={apiVersion} onInput={(e) => setApiVersion(val(e))} data-testid="input-api-version" /></label>
        </div>
        <h3>Session & refresh</h3>
        <div className="grid2">
          <label className="field"><span>Auto-lock after idle (minutes)</span><input className="input" type="number" min={1} max={120} value={idle} onInput={(e) => setIdle(val(e))} data-testid="input-idle" /></label>
          <label className="field"><span>Refresh interval (seconds)</span><input className="input" type="number" min={0} max={3600} value={refresh} onInput={(e) => setRefresh(val(e))} data-testid="input-refresh" />
            <small>0 = manual only. Inactive-tab refresh is opt-in under Notifications. Auto-lock always stops monitoring.</small></label>
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="row"><button className="btn primary" data-testid="button-save-settings">{saved ? 'Saved' : 'Save settings'}</button></div>
      </form>}

      {tab === 'accounts' && <div className="section">
        <h3>Connected on this device</h3>
        {p.profile.accounts.length === 0
          ? <p className="muted" style={{ margin: 0 }}>No accounts yet. Connecting opens Facebook Login in this tab and returns here; you will unlock again, then your Pages and linked Instagram business accounts are added.</p>
          : <div className="list">{p.profile.accounts.map((a) => {
            const expired = a.expiresAt > 0 && a.expiresAt < now;
            return <div className="list-row" key={a.id} data-testid={`row-account-${a.id}`}>
              <PlatformPill platform={a.platform} />
              <span className="grow"><b>{a.name}</b><small>{expired ? 'Token expired — reconnect' : a.expiresAt ? `Token valid ${Math.max(0, Math.round((a.expiresAt - now) / 864e5))} more days` : 'Token without expiry'}</small></span>
              {expired && <span className="chip flare">expired</span>}
              <button className="icon-btn" onClick={() => setRemoving(a.id)} aria-label={`Remove ${a.name}`} data-testid={`button-remove-account-${a.id}`}><Trash2 /></button>
            </div>;
          })}</div>}
        <div className="row">
          <button className="btn primary" disabled={!s.appId} onClick={p.onConnect} data-testid="button-connect">
            {p.profile.accounts.length ? <RefreshCw /> : <PlatformLogo platform="facebook" size="small" />}{p.profile.accounts.length ? 'Reconnect / add accounts' : 'Connect with Facebook'}</button>
          {!s.appId && <span className="muted" style={{ fontSize: 12.5 }}>Add your App ID under General first.</span>}
        </div>
        <h3 style={{ marginTop: 8 }}>Demo mode</h3>
        <div className="list"><div className="list-row">
          <FlaskConical size={18} />
          <span className="grow"><b>Show sample comments</b><small>Fictional bakery data held in memory only. Never saved, never sent. Moderation actions on samples are simulated.</small></span>
          <button className={`btn sm${p.demo ? ' primary' : ''}`} aria-pressed={p.demo} onClick={() => p.onDemo(!p.demo)} data-testid="button-toggle-demo">{p.demo ? 'On' : 'Off'}</button>
        </div></div>
      </div>}

      {tab === 'watchlist' && <div className="section">
        <h3>Keyword watchlist</h3>
        <p className="muted" style={{ margin: 0 }}>Matching comments are flagged and highlighted in every column. Case-insensitive.</p>
        <form className="row" onSubmit={addTerm}>
          <input className="input" value={term} onInput={(e) => setTerm(val(e))} placeholder="refund, allergy, giveaway…" aria-label="New watchlist term" data-testid="input-watch-term" />
          <button className="btn primary" data-testid="button-add-term">Add</button>
        </form>
        <div className="terms">
          {p.profile.watchlist.length === 0 && <span className="muted">No terms yet.</span>}
          {p.profile.watchlist.map((w) => <span className="term" key={w}>{w}
            <button aria-label={`Remove ${w}`} onClick={() => p.onUpdate((x) => ({ ...x, watchlist: x.watchlist.filter((t) => t !== w) }))} data-testid={`button-remove-term-${w}`}><X /></button></span>)}
        </div>
      </div>}

      {tab === 'notifications' && <NotificationSettings profile={p.profile} onUpdate={p.onUpdate} />}
      {tab === 'data' && <DataTab profile={p.profile} onUpdate={p.onUpdate} onAudit={p.onAudit} onWipe={() => setWipe(true)} />}

      {removing && <Confirm title="Remove account?" danger confirmLabel="Remove account"
        body="Its token, fetched posts and comments are removed from this device. The account itself is untouched on Meta."
        onConfirm={() => p.onUpdate((x) => ({ ...x, settings: { ...x.settings, notifications: Object.fromEntries(Object.entries(x.settings.notifications || {}).filter(([id]) => id !== removing)) }, accounts: x.accounts.filter((a) => a.id !== removing), posts: x.posts.filter((q) => q.accountId !== removing), comments: x.comments.filter((c) => c.accountId !== removing), columns: x.columns.map((c) => (c.accountId === removing ? { ...c, accountId: undefined, postId: undefined } : c)) }))}
        onClose={() => setRemoving(null)} />}
      {wipe && <Confirm title="Wipe all data on this device" danger requireText="WIPE" confirmLabel="Wipe everything"
        body="Deletes the encrypted vault, tokens, accounts, columns, tiles, watchlist and audit log from this browser. Exported .swprofile files are not affected."
        onConfirm={p.onWipe} onClose={() => setWipe(false)} />}
    </Dialog>
  );
}

function DataTab({ profile, onUpdate, onAudit, onWipe }: { profile: Profile; onUpdate: SettingsProps['onUpdate']; onAudit: () => void; onWipe: () => void }) {
  const [exPass, setExPass] = useState('');
  const [exMsg, setExMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [imPass, setImPass] = useState('');
  const [imMsg, setImMsg] = useState('');
  const [preview, setPreview] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async (e: Event) => {
    e.preventDefault();
    if (exPass.length < 12) return setExMsg('Export passphrase needs at least 12 characters.');
    setBusy(true);
    try {
      download(await exportProfile(profile, exPass), `social-watch-${new Date().toISOString().slice(0, 10)}.swprofile`);
      setExMsg('Exported. Keep the passphrase somewhere safe; it is not stored.');
      setExPass('');
    } catch (x) { setExMsg(`Export failed: ${errMsg(x)}`); } finally { setBusy(false); }
  };
  const doImport = async (e: Event) => {
    e.preventDefault();
    if (!file) return setImMsg('Choose a .swprofile file.');
    setBusy(true);
    try { setPreview(await importProfile(file, imPass)); setImMsg(''); setImPass(''); }
    catch { setImMsg('Could not decrypt that file. Check the passphrase and file.'); }
    finally { setBusy(false); }
  };
  const apply = () => {
    if (!preview) return;
    onUpdate((x) => ({ ...x, settings: { ...preview.settings, notifications: x.settings.notifications || {} }, columns: preview.columns, tiles: preview.tiles, watchlist: preview.watchlist }));
    setPreview(null); setFile(null); setImMsg('Settings imported and re-encrypted under this device’s passphrase.');
  };

  return <div className="section">
        <p className="note" style={{ margin: 0 }}>Profile files carry settings only: App ID, API version, timers, theme, company logo, columns, launch tiles and watchlist. Accounts, tokens, posts, comments and the audit log are intentionally left out — each device connects separately.</p>
    <h3>Export .swprofile</h3>
    <form className="row" onSubmit={doExport}>
      <input className="input" type="password" autoComplete="new-password" placeholder="Separate export passphrase (12+)" value={exPass} onInput={(e) => setExPass(val(e))} aria-label="Export passphrase" data-testid="input-export-pass" />
      <button className="btn" disabled={busy} data-testid="button-export"><Download /> Export</button>
    </form>
    {exMsg && <div className="muted" role="status">{exMsg}</div>}
    <h3>Import .swprofile</h3>
    <form className="section" onSubmit={doImport}>
      <input className="input" type="file" accept=".swprofile" style={{ paddingTop: 5 }} onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} aria-label="Profile file" data-testid="input-import-file" />
      <div className="row">
        <input className="input" type="password" autoComplete="off" placeholder="File passphrase" value={imPass} onInput={(e) => setImPass(val(e))} aria-label="Import passphrase" data-testid="input-import-pass" />
        <button className="btn" disabled={busy || !file} data-testid="button-import"><Upload /> Decrypt</button>
      </div>
    </form>
    {imMsg && <div className="muted" role="status">{imMsg}</div>}
    {preview && <div className="list"><div className="list-row" style={{ alignItems: 'flex-start' }}>
      <AlertTriangle size={18} style={{ color: 'hsl(var(--amber))', flex: 'none' }} />
      <span className="grow"><b>Replace current settings?</b>
        <small>{preview.columns.length} columns · {preview.tiles.length} tiles · {preview.watchlist.length} watchlist terms · App ID {preview.settings.appId || 'not set'} · {preview.settings.apiVersion} · lock {preview.settings.idleMinutes}m · refresh {preview.settings.refreshSeconds || 'manual'}</small>
        <small>Your accounts, comments and audit log on this device are kept.</small></span>
      <div className="row"><button className="btn sm" onClick={() => setPreview(null)}>Cancel</button><button className="btn sm primary" onClick={apply} data-testid="button-apply-import">Replace</button></div>
    </div></div>}
    <h3>Audit log</h3>
    <div className="row"><button className="btn" onClick={onAudit} data-testid="button-open-audit"><ScrollText /> View audit log ({profile.audit.length})</button></div>
    <div className="danger-zone">
      <b>Wipe all data</b>
      <span className="muted">Erase everything Social Watch stores in this browser.</span>
      <div><button className="btn danger" onClick={onWipe} data-testid="button-wipe"><Trash2 /> Wipe all data</button></div>
    </div>
  </div>;
}

export function AuditLog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const rows = [...profile.audit].reverse();
  const exp = (kind: 'json' | 'csv') => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'json') return download(new Blob([JSON.stringify(profile.audit, null, 2)], { type: 'application/json' }), `social-watch-audit-${stamp}.json`);
    const q = (s: string) => `"${(/^[=+\-@\t\r\n]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
    const csv = ['at,action,commentId,detail', ...profile.audit.map((a) => [a.at, a.action, a.commentId ?? '', a.detail].map(q).join(','))].join('\n');
    download(new Blob([csv], { type: 'text/csv' }), `social-watch-audit-${stamp}.csv`);
  };
  return <Dialog title="Audit log" wide onClose={onClose} id="audit"
    footer={<><span className="muted" style={{ marginRight: 'auto', fontSize: 12.5 }}>Stored encrypted on this device only.</span>
      <button className="btn" disabled={!rows.length} onClick={() => exp('csv')} data-testid="button-export-audit-csv"><Download /> CSV</button>
      <button className="btn" disabled={!rows.length} onClick={() => exp('json')} data-testid="button-export-audit-json"><Download /> JSON</button></>}>
    {rows.length === 0
      ? <div className="empty"><span className="empty-ico"><ScrollText /></span><b>No actions yet</b><p>Reviews, hides, replies and deletions are recorded here as you moderate.</p></div>
      : <table className="audit-table"><thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody>{rows.slice(0, 500).map((a) => <tr key={a.id}><td className="mono" title={a.at}>{ago(a.at)}</td><td><span className="chip">{a.action}</span></td><td>{a.detail}</td></tr>)}</tbody></table>}
  </Dialog>;
}

export function Help({ onClose }: { onClose: () => void }) {
  const keys: [string, string][] = [['r', 'Refresh now'], ['l', 'Lock immediately'], ['?', 'Open this help'], ['Esc', 'Close dialog']];
  return <Dialog title="Help & install" wide onClose={onClose} id="help">
    <div className="section"><h3>Keyboard</h3>
      <div className="list">{keys.map(([k, d]) => <div className="list-row" key={k}><span className="kbd">{k}</span><span className="grow">{d}</span></div>)}</div>
      <small className="muted">Shortcuts are ignored while typing in a field.</small></div>
    <div className="grid2">
      <div className="section"><h3>Install on Windows</h3><ol className="help-steps">
        <li>Open Social Watch in Edge or Chrome.</li><li>Choose the install icon in the address bar, or menu then Apps then Install.</li><li>It launches in its own window, no executable needed.</li></ol></div>
      <div className="section"><h3>Install on iPhone / iPad</h3><ol className="help-steps">
        <li>Open in Safari.</li><li>Tap Share, then Add to Home Screen.</li><li>Pull down on a column to refresh; iOS does not allow background polling.</li></ol></div>
    </div>
    <div className="section"><h3>Connecting Meta</h3><ol className="help-steps">
      <li>Create your own app at developers.facebook.com in development mode and add Facebook Login.</li>
      <li>Add this site’s address as a valid OAuth redirect URI.</li>
      <li>Paste the App ID in Settings, then Connect. Pages and linked Instagram business accounts are discovered automatically.</li>
      <li>Tokens are short-lived. When one expires you will see a one-tap reconnect banner.</li></ol></div>
    <div className="section"><h3>Limits worth knowing</h3><ol className="help-steps">
      <li>Refresh normally runs only while visible. Settings → Notifications can allow best-effort inactive-tab refresh while unlocked; browsers may throttle or suspend it. Auto-lock and closing the app stop monitoring.</li>
      <li>Opt in per Facebook/Instagram account for generic local alerts about new comments, replies or watchlist matches. No server push is used. iPhone cannot reliably poll in the background, even when installed.</li>
      <li>Refresh fetches the latest 20 posts per account with their comments and replies.</li>
      <li>Activity shows recent comments fetched to this device, not a platform-wide mentions feed.</li>
      <li>LinkedIn and TikTok are launch tiles only; they have no moderation API here.</li></ol></div>
  </Dialog>;
}

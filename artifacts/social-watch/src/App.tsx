import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RefreshCw, Lock, Settings as Cog, HelpCircle, Moon, Sun, ScrollText, AlertTriangle, Plug, X, FlaskConical } from 'lucide-react';
import { defaultProfile, ProfileSchema, type Column, type Comment, type Profile, type Tile } from './core/types';
import { createVault, hasVault, lockVault, saveProfile, unlockVault, wipeVault } from './core/vault';
import { MetaError, beginLogin, clearPendingOAuth, discoverAccounts, finishLogin, moderate, refreshMeta, setMetaRequestGuard } from './core/meta';
import { canRefresh, dismissLocalNotifications, selectAlerts, showLocalNotification } from './core/notifications';
import { Gate, BrandMark } from './ui/Gate';
import { AddColumn, DeckColumn, TYPE_LABEL, type DeckData, type ModAction } from './ui/Deck';
import { AuditLog, Help, Settings } from './ui/Panels';
import { ago, audit, errMsg, makeDemo, uid, type DemoData } from './ui/util';

type Phase = 'boot' | 'setup' | 'unlock' | 'app';
type Modal = null | 'settings' | 'help' | 'audit' | 'accounts';
interface Problem { message: string; reauth?: boolean; retryAt?: number }
interface Problem { message: string; reauth?: boolean; retryAt?: number }
interface Problem { message: string; reauth?: boolean; retryAt?: number }
interface Problem { message: string; reauth?: boolean; retryAt?: number }

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [profile, setProfile] = useState<Profile | null>(null);
  const ref = useRef<Profile | null>(null);
  const [demo, setDemo] = useState<DemoData | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [saveError, setSaveError] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [active, setActive] = useState(0);
  const deckRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const session = useRef(0);
  const idleDeadline = useRef(0);
  const baselinedAccounts = useRef(new Set<string>());
  const notificationSeen = useRef(new Set<string>());

  useEffect(() => {
    hasVault().then((h) => setPhase(h ? 'unlock' : 'setup')).catch(() => {
      setPhase('setup');
      setSaveError('Device storage is unavailable. Enable browser storage before creating a vault.');
    });
  }, []);

  const [systemColorScheme, setSystemColorScheme] = useState<'light' | 'dark'>(systemTheme());
  const themeMode = profile?.settings.theme ?? 'system';
  const theme = themeMode === 'system' ? systemColorScheme : themeMode;
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemColorScheme(query.matches ? 'dark' : 'light');
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  const update = useCallback((fn: (p: Profile) => Profile) => {
    if (!ref.current) return;
    let next: Profile;
    try { next = ProfileSchema.parse(fn(ref.current)); }
    catch { setSaveError('This change is invalid or exceeds the profile safety limits. It was not saved.'); return; }
    ref.current = next;
    setProfile(next);
    const started = session.current;
    saveProfile(next).then(() => {
      if (started === session.current) setSaveError('');
    }).catch((e) => {
      if (started === session.current) setSaveError(`Changes could not be saved to the encrypted vault: ${errMsg(e)}`);
    });
  }, []);

  const lock = useCallback(() => {
    session.current++;
    clearPendingOAuth();
    baselinedAccounts.current.clear();
    notificationSeen.current.clear();
    void dismissLocalNotifications().catch(() => {});
    lockVault();
    ref.current = null;
    setProfile(null); setDemo(null); setModal(null); setProblem(null); setSaveError(''); setLastRefresh(null); setToast('');
    setPhase('unlock');
  }, []);

  useEffect(() => {
    setMetaRequestGuard(() => {
      if (ref.current && idleDeadline.current && Date.now() >= idleDeadline.current) { lock(); return false; }
      return canRefresh(ref.current, document.hidden, idleDeadline.current);
    });
    return () => setMetaRequestGuard(() => false);
  }, [lock]);

  const showMetaError = (e: unknown) => {
    if (e instanceof MetaError) setProblem({ message: e.message, reauth: e.reauth, retryAt: e.retryAt });
    else setProblem({ message: errMsg(e) });
  };

  const refresh = useCallback(async () => {
    const p = ref.current;
    const started = session.current;
    if (!p || busyRef.current) return;
    if (idleDeadline.current && Date.now() >= idleDeadline.current) { lock(); return; }
    if (!canRefresh(p, document.hidden, idleDeadline.current)) return;
    if (!p.accounts.some((a) => a.token)) { if (demo) flash('Demo data is static — nothing to fetch'); return; }
    busyRef.current = true; setRefreshing(true);
    try {
      const { posts, comments } = await refreshMeta(p);
      if (!ref.current || started !== session.current) return;
      const latest = ref.current;
      // Remember IDs across temporary disappearance, avoiding repeat alerts this session.
      const unseen = comments.filter(c => !notificationSeen.current.has(`${c.accountId}:${c.id}`));
      const alerts = selectAlerts(latest, unseen, baselinedAccounts.current);
      latest.accounts.forEach(a => baselinedAccounts.current.add(a.id));
      comments.forEach(c => notificationSeen.current.add(`${c.accountId}:${c.id}`));
      update((x) => {
        const old = new Map(x.comments.map((c) => [c.id, c]));
        return { ...x, posts, comments: comments.map((c) => ({ ...c, reviewed: old.get(c.id)?.reviewed ?? c.reviewed })) };
      });
      setProblem(null); setLastRefresh(Date.now());
      if (document.hidden && alerts.size) {
        const stillAllowed = () => started === session.current &&
          canRefresh(ref.current, document.hidden, idleDeadline.current) &&
          document.hidden;
        const count = [...alerts].reduce((n, [accountId, total]) =>
          n + (ref.current?.settings.notifications?.[accountId]?.enabled ? total : 0), 0);
        if (count) {
          try { await showLocalNotification(count, stillAllowed); }
          catch (e) { if (stillAllowed()) flash(`Notification unavailable: ${errMsg(e)}`); }
        }
      }
    } catch (e) { if (started === session.current && ref.current) showMetaError(e); }
    finally { busyRef.current = false; setRefreshing(false); }
  }, [update, demo, lock]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const connect = useCallback(async () => {
    const p = ref.current;
    if (!p?.settings.appId) { setModal('settings'); return; }
    try { await saveProfile(p); await beginLogin(p.settings.appId, p.settings.apiVersion); }
    catch (e) { showMetaError(e); }
  }, []);

  const onUnlocked = async (p: Profile) => {
    const started = ++session.current;
    baselinedAccounts.current.clear();
    notificationSeen.current.clear();
    idleDeadline.current = Date.now() + p.settings.idleMinutes * 60000;
    setSaveError('');
    ref.current = p; setProfile(p); setPhase('app');
    try {
      const login = await finishLogin();
      if (login) {
        const found = await discoverAccounts(login.token, login.expiresAt, p.settings.apiVersion);
        if (started !== session.current || !ref.current) return;
        update((x) => {
          const ids = new Set(found.map((a) => a.id));
          return { ...x, accounts: [...x.accounts.filter((a) => !ids.has(a.id)), ...found], audit: [...x.audit, audit('connect', `Connected ${found.length} account(s)`)] };
        });
        flash(`Connected ${found.length} account${found.length === 1 ? '' : 's'}`);
      }
    } catch (e) { if (started === session.current && ref.current) showMetaError(e); }
    void refreshRef.current();
  };

  // idle lock
  useEffect(() => {
    if (phase !== 'app' || !profile) return;
    let t = 0;
    const arm = () => {
      if (idleDeadline.current && Date.now() >= idleDeadline.current) { lock(); return; }
      clearTimeout(t);
      idleDeadline.current = Date.now() + profile.settings.idleMinutes * 60000;
      t = window.setTimeout(lock, profile.settings.idleMinutes * 60000);
    };
    const checkIdle = () => { if (!document.hidden && Date.now() >= idleDeadline.current) lock(); };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, arm, { passive: true, capture: true }));
    idleDeadline.current = 0;
    arm();
    document.addEventListener('visibilitychange', checkIdle);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', checkIdle); evs.forEach((e) => window.removeEventListener(e, arm, { capture: true })); };
  }, [phase, profile?.settings.idleMinutes, lock]);

  // interval + reopen refresh
  useEffect(() => {
    if (phase !== 'app') return;
    const secs = profile?.settings.refreshSeconds ?? 0;
    const iv = secs ? window.setInterval(() => { void refreshRef.current(); }, secs * 1000) : 0;
    const vis = () => {
      if (!document.hidden) {
        if (idleDeadline.current && Date.now() >= idleDeadline.current) { lock(); return; }
        void refreshRef.current();
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, [phase, profile?.settings.refreshSeconds]);

  // shortcuts
  useEffect(() => {
    if (phase !== 'app') return;
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.key === 'r') { e.preventDefault(); void refreshRef.current(); }
      else if (e.key === 'l') { e.preventDefault(); lock(); }
      else if (e.key === '?') { e.preventDefault(); setModal('help'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [phase, lock]);

  const isDemo = useCallback((id: string) => id.startsWith('demo-'), []);

  const data: DeckData = useMemo(() => ({
    accounts: [...(profile?.accounts ?? []), ...(demo?.accounts ?? [])],
    posts: [...(profile?.posts ?? []), ...(demo?.posts ?? [])],
    comments: [...(profile?.comments ?? []), ...(demo?.comments ?? [])],
    tiles: profile?.tiles ?? [], watchlist: profile?.watchlist ?? [],
    loading: refreshing && !lastRefresh,
  }), [profile, demo, refreshing, lastRefresh]);

  const onModerate = useCallback(async (c: Comment, a: ModAction, msg?: string) => {
    const p = ref.current;
    const started = session.current;
    if (!p) return;
    const label = { hide: 'Hid', unhide: 'Unhid', delete: 'Deleted', reply: 'Replied to' }[a];
    if (isDemo(c.id)) {
      setDemo((d) => {
        if (!d) return d;
        let comments = d.comments;
        if (a === 'hide' || a === 'unhide') comments = comments.map((x) => (x.id === c.id ? { ...x, hidden: a === 'hide' } : x));
        if (a === 'delete') comments = comments.filter((x) => x.id !== c.id && x.parentId !== c.id);
        if (a === 'reply') comments = [...comments, { id: `demo-${uid()}`, postId: c.postId, accountId: c.accountId, author: d.accounts.find((x) => x.id === c.accountId)?.name ?? 'You', text: msg ?? '', createdAt: new Date().toISOString(), hidden: false, reviewed: true, parentId: c.parentId ?? c.id }];
        return { ...d, comments };
      });
      update((x) => ({ ...x, audit: [...x.audit, audit(a, `[simulation] ${label} sample comment by ${c.author}`, c.id)] }));
      flash(`Simulated: ${label.toLowerCase()} comment`);
      return;
    }
    try {
      await moderate(p, c, a, msg);
      if (!ref.current || started !== session.current) return;
      update((x) => ({
        ...x,
        comments: a === 'delete' ? x.comments.filter((y) => y.id !== c.id && y.parentId !== c.id)
          : a === 'reply' ? x.comments.map((y) => (y.id === c.id ? { ...y, reviewed: true } : y))
          : x.comments.map((y) => (y.id === c.id ? { ...y, hidden: a === 'hide' } : y)),
        audit: [...x.audit, audit(a, `${label} comment by ${c.author}${a === 'reply' ? `: ${(msg ?? '').slice(0, 120)}` : ''}`, c.id)],
      }));
      flash(`${label} comment`);
      if (a === 'reply') void refreshRef.current();
    } catch (e) { if (ref.current && started === session.current) showMetaError(e); throw e; }
  }, [update, isDemo]);

  const onReview = useCallback((c: Comment) => {
    const v = !c.reviewed;
    if (isDemo(c.id)) setDemo((d) => d && { ...d, comments: d.comments.map((x) => (x.id === c.id ? { ...x, reviewed: v } : x)) });
    update((x) => ({
      ...x,
      comments: x.comments.map((y) => (y.id === c.id ? { ...y, reviewed: v } : y)),
      audit: [...x.audit, audit(v ? 'review' : 'unreview', `${isDemo(c.id) ? '[simulation] ' : ''}Marked comment by ${c.author} ${v ? 'reviewed' : 'unreviewed'}`, c.id)],
    }));
  }, [update, isDemo]);

  const wipe = async () => {
    // Even if deletion fails, never leave an unlocked-looking desk with no key.
    lock();
    baselinedAccounts.current.clear();
    notificationSeen.current.clear();
    void dismissLocalNotifications().catch(() => {});
    try { await wipeVault(); setPhase('setup'); }
    catch (e) { setSaveError(`Wipe failed: ${errMsg(e)}`); }
  };

  if (phase === 'boot') return <div className="gate" aria-busy="true" />;
  if (phase === 'setup' || phase === 'unlock' || !profile) {
    return <Gate key={phase} mode={phase === 'setup' ? 'setup' : 'unlock'} onWipe={wipe} storageError={saveError}
      onSubmit={async (pass) => {
        if (phase === 'setup') { const p = defaultProfile(); await createVault(pass, p); await onUnlocked(p); }
        else await onUnlocked(await unlockVault(pass));
      }} />;
  }

  const cols = profile.columns;
  const setCols = (c: Column[]) => update((x) => ({ ...x, columns: c }));
  const expired = profile.accounts.filter((a) => a.expiresAt > 0 && a.expiresAt < Date.now());
  const coolingDown = !!problem?.retryAt && problem.retryAt > Date.now();
  const scrollTo = (i: number) => { const el = deckRef.current?.children[i] as HTMLElement | undefined; el?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' }); };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          {profile.settings.brandLogo
            ? <img className="brand-logo" src={profile.settings.brandLogo} alt="Company brand logo" />
            : <BrandMark />}
          <span>Social Watch</span>
        </div>
        <div className="top-mid">
          <span className="status" role="status" data-testid="status-refresh">
            <span className={`dot${refreshing ? ' busy' : problem || saveError ? ' bad' : ''}`} />
            <span className="lbl">{refreshing ? 'Refreshing…' : lastRefresh ? `Updated ${ago(lastRefresh)}` : profile.accounts.length ? 'Not refreshed yet' : 'No accounts connected'}
              {profile.settings.refreshSeconds ? ` · every ${Math.round(profile.settings.refreshSeconds / 60)}m${profile.settings.backgroundRefresh ? ' · inactive tabs allowed (best effort)' : ''}` : ' · manual'}</span>
          </span>
          {demo && <span className="chip demo-pill" data-testid="status-demo"><FlaskConical /> Demo · simulated</span>}
        </div>
        <button className="icon-btn" onClick={() => void refresh()} disabled={refreshing || coolingDown} aria-label="Refresh (r)" title="Refresh (r)" data-testid="button-refresh"><RefreshCw className={refreshing ? 'spin' : ''} /></button>
        <button className="icon-btn hide-sm" onClick={() => setModal('audit')} aria-label="Audit log" title="Audit log" data-testid="button-audit"><ScrollText /></button>
        <button className="icon-btn" onClick={() => update((x) => ({ ...x, settings: { ...x.settings, theme: theme === 'dark' ? 'light' : 'dark' } }))}
          aria-label={`${themeMode === 'system' ? 'Automatic theme' : `${themeMode} theme`}; switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`${themeMode === 'system' ? 'Automatic' : themeMode} theme · switch to ${theme === 'dark' ? 'light' : 'dark'}`}
          data-testid="button-theme">{theme === 'dark' ? <Sun /> : <Moon />}</button>
        <button className="icon-btn" onClick={() => setModal('help')} aria-label="Help (?)" title="Help (?)" data-testid="button-help"><HelpCircle /></button>
        <button className="icon-btn" onClick={() => setModal('settings')} aria-label="Settings" title="Settings" data-testid="button-settings"><Cog /></button>
        <button className="btn sm" onClick={lock} title="Lock (l)" data-testid="button-lock"><Lock /> <span className="hide-sm">Lock</span></button>
      </header>

      <div className="banners" aria-live="polite">
        {saveError && <div className="banner bad" role="alert"><AlertTriangle /><span className="grow">{saveError}</span><button className="btn sm" onClick={() => update((x) => x)}>Retry save</button></div>}
        {problem && <div className="banner bad" role="alert" data-testid="banner-meta-error"><AlertTriangle /><span className="grow">{problem.message}{coolingDown ? ` · rate limited, retry after ${new Date(problem.retryAt!).toLocaleTimeString()}` : ''}</span>
          {problem.reauth && <button className="btn sm primary" onClick={() => void connect()} data-testid="button-reauth"><Plug /> Re-authenticate</button>}
          {!problem.reauth && !coolingDown && <button className="btn sm" onClick={() => void refresh()}>Retry</button>}
          <button className="icon-btn" onClick={() => setProblem(null)} aria-label="Dismiss error"><X /></button></div>}
        {!problem && expired.length > 0 && <div className="banner warn" role="alert"><AlertTriangle /><span className="grow">{expired.map((a) => a.name).join(', ')} {expired.length === 1 ? 'needs' : 'need'} a fresh login.</span>
          <button className="btn sm primary" onClick={() => void connect()} data-testid="button-reconnect"><Plug /> Reconnect</button></div>}
        {!profile.accounts.length && !demo && <div className="banner info"><Plug /><span className="grow">{profile.settings.appId ? 'Your App ID is set. Connect Facebook to pull in Pages and Instagram accounts.' : 'Add your own Meta App ID to start, or explore with clearly labelled sample data.'}</span>
          <button className="btn sm" onClick={() => setDemo(makeDemo())} data-testid="button-demo">Try demo</button>
          <button className="btn sm primary" onClick={() => (profile.settings.appId ? void connect() : setModal('accounts'))} data-testid="button-get-started">{profile.settings.appId ? 'Connect' : 'Set up'}</button></div>}
      </div>

      <main className="deck" ref={deckRef} aria-label="Columns"
        onScroll={(e) => { const el = e.currentTarget as HTMLElement; setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}>
        {cols.map((c, i) => (
          <DeckColumn key={c.id} col={c} index={i} total={cols.length} data={data} refreshing={refreshing}
            onChange={(n) => setCols(cols.map((x) => (x.id === n.id ? n : x)))}
            onMove={(d) => { const n = [...cols]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x!); setCols(n); }}
            onRemove={() => setCols(cols.filter((x) => x.id !== c.id))}
            onModerate={onModerate} onReview={onReview}
            onTiles={(t: Tile[]) => update((x) => ({ ...x, tiles: t }))}
            onRefresh={() => void refresh()} isDemo={isDemo} />
        ))}
        {cols.length < 30 && <AddColumn onAdd={(t) => { setCols([...cols, { id: uid(), type: t, title: TYPE_LABEL[t] }]); setTimeout(() => scrollTo(cols.length), 50); }} />}
      </main>

      <nav className="dots" aria-label="Jump to column">
        {cols.map((c, i) => <button key={c.id} aria-current={active === i} onClick={() => scrollTo(i)}>{c.title}</button>)}
      </nav>

      {(modal === 'settings' || modal === 'accounts') && <Settings profile={profile} demo={!!demo} initialTab={modal === 'accounts' ? 'general' : undefined}
        onClose={() => setModal(null)} onUpdate={update} onConnect={() => void connect()}
        onDemo={(on) => setDemo(on ? makeDemo() : null)} onWipe={() => void wipe()} onAudit={() => setModal('audit')} />}
      {modal === 'audit' && <AuditLog profile={profile} onClose={() => setModal(null)} />}
      {modal === 'help' && <Help onClose={() => setModal(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default App;

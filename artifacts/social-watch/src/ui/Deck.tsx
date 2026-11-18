import { useMemo, useRef, useState } from 'preact/hooks';
import {
  Inbox, MessageSquare, Activity, Rocket, ChevronLeft, ChevronRight, SlidersHorizontal, Trash2,
  Check, EyeOff, Eye, Reply, ArrowUpRight, Plus, Pencil, ChevronUp, ChevronDown, RefreshCw, CornerDownRight,
} from 'lucide-react';
import type { Account, Column, Comment, Post, Tile } from '../core/types';
import { ago, escapeRe, initials, isHttps, ms, uid, val } from './util';
import { Confirm, Dialog } from './Dialog';
import { PlatformLogo, PlatformPill } from './PlatformLogo';

export type ModAction = 'hide' | 'unhide' | 'delete' | 'reply';

export interface DeckData {
  accounts: Account[];
  posts: Post[];
  comments: Comment[];
  tiles: Tile[];
  watchlist: string[];
  loading: boolean;
}

const ICONS = { queue: Inbox, post: MessageSquare, activity: Activity, launch: Rocket };
export const TYPE_LABEL = { queue: 'Moderation queue', post: 'Post comments', activity: 'Recent activity', launch: 'Launch tiles' };

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map(escapeRe).join('|')})`, 'gi');
  const parts = text.split(re);
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

function CommentCard({ c, data, onModerate, onReview, isDemo }: {
  c: Comment; data: DeckData; isDemo: boolean;
  onModerate: (c: Comment, a: ModAction, msg?: string) => Promise<void>; onReview: (c: Comment) => void;
}) {
  const [busy, setBusy] = useState<ModAction | null>(null);
  const [replying, setReplying] = useState(false);
  const [msg, setMsg] = useState('');
  const [del, setDel] = useState(false);
  const acc = data.accounts.find((a) => a.id === c.accountId);
  const post = data.posts.find((p) => p.id === c.postId);
  const hot = data.watchlist.some((w) => c.text.toLowerCase().includes(w.toLowerCase()));
  const run = async (a: ModAction, m?: string) => {
    setBusy(a);
    try { await onModerate(c, a, m); if (a === 'reply') { setReplying(false); setMsg(''); } }
    catch { /* surfaced by app banner */ }
    finally { setBusy(null); }
  };
  return (
    <article className={`card${hot ? ' hot' : ''}${c.reviewed ? ' reviewed' : ''}${c.hidden ? ' hidden-c' : ''}${c.parentId ? ' reply-c' : ''}`} data-testid={`card-comment-${c.id}`}>
      <div className="c-head">
        <span className="avatar" aria-hidden="true">{initials(c.author)}</span>
        <div className="c-who"><b>{c.author}</b><small>{acc?.name ?? 'Unknown account'} · <time dateTime={c.createdAt}>{ago(c.createdAt)}</time></small></div>
        {acc && <PlatformPill platform={acc.platform} compact />}
      </div>
      {post && <div className="c-post">{c.parentId && <CornerDownRight size={11} />} on “{post.text.slice(0, 80)}”</div>}
      <div className="c-text"><Highlight text={c.text} terms={data.watchlist} /></div>
      <div className="row" style={{ gap: 4 }}>
        {hot && <span className="chip flare">watchlist</span>}
        {c.hidden && <span className="chip amber">hidden</span>}
        {c.reviewed && <span className="chip ok">reviewed</span>}
        {isDemo && <span className="chip demo-pill">simulation</span>}
      </div>
      {replying && (
        <form className="reply-box" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) void run('reply', msg.trim()); }}>
          <label className="sr-only" htmlFor={`r-${c.id}`}>Reply to {c.author}</label>
          <textarea id={`r-${c.id}`} className="textarea" autoFocus value={msg} onInput={(e) => setMsg(val(e))}
            placeholder={`Reply publicly to ${c.author}`} data-testid={`input-reply-${c.id}`}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setReplying(false); } }} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn sm ghost" onClick={() => setReplying(false)}>Cancel</button>
            <button className="btn sm primary" disabled={!msg.trim() || !!busy} data-testid={`button-send-reply-${c.id}`}>{busy === 'reply' ? 'Sending…' : 'Send reply'}</button>
          </div>
        </form>
      )}
      <div className="c-actions">
        <button className={`icon-btn${c.reviewed ? ' on' : ''}`} onClick={() => onReview(c)} aria-pressed={c.reviewed}
          aria-label={c.reviewed ? 'Mark unreviewed' : 'Mark reviewed'} title={c.reviewed ? 'Mark unreviewed' : 'Mark reviewed'} data-testid={`button-review-${c.id}`}><Check /></button>
        <button className="icon-btn" disabled={!!busy} onClick={() => run(c.hidden ? 'unhide' : 'hide')}
          aria-label={c.hidden ? 'Unhide comment' : 'Hide comment'} title={c.hidden ? 'Unhide' : 'Hide'} data-testid={`button-hide-${c.id}`}>
          {busy === 'hide' || busy === 'unhide' ? <RefreshCw className="spin" /> : c.hidden ? <Eye /> : <EyeOff />}
        </button>
        <button className={`icon-btn${replying ? ' on' : ''}`} onClick={() => setReplying((r) => !r)} aria-label="Reply" title="Reply" data-testid={`button-reply-${c.id}`}><Reply /></button>
        {post?.permalink && <a className="icon-btn" href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label="Open post on platform" title="Open post"><ArrowUpRight /></a>}
        <span className="grow" />
        <button className="icon-btn del" disabled={!!busy} onClick={() => setDel(true)} aria-label="Delete comment" title="Delete" data-testid={`button-delete-${c.id}`}>
          {busy === 'delete' ? <RefreshCw className="spin" /> : <Trash2 />}
        </button>
      </div>
      {del && <Confirm title="Delete this comment?" danger confirmLabel="Delete comment"
        body={<>Deleting removes the comment from {acc?.name ?? 'the platform'} permanently{isDemo ? ' (simulated: local sample data only)' : ''}. “{c.text.slice(0, 140)}”</>}
        onConfirm={() => void run('delete')} onClose={() => setDel(false)} />}
    </article>
  );
}

function Empty({ icon: I, title, body }: { icon: typeof Inbox; title: string; body: string }) {
  return <div className="empty"><span className="empty-ico"><I /></span><b>{title}</b><p>{body}</p></div>;
}

function TileEditor({ tile, onSave, onClose }: { tile: Tile | null; onSave: (t: Tile) => void; onClose: () => void }) {
  const [title, setTitle] = useState(tile?.title ?? '');
  const [url, setUrl] = useState(tile?.url ?? 'https://');
  const [platform, setPlatform] = useState<Tile['platform']>(tile?.platform ?? 'custom');
  const [err, setErr] = useState('');
  const save = () => {
    if (!title.trim()) return setErr('Give the tile a name.');
    if (!isHttps(url.trim())) return setErr('Links must be valid https:// addresses.');
    const u = new URL(url.trim());
    if (u.username || u.password) return setErr('Links cannot contain credentials.');
    onSave({ id: tile?.id ?? uid(), title: title.trim().slice(0, 200), url: u.toString(), platform });
    onClose();
  };
  return (
    <Dialog title={tile ? 'Edit launch tile' : 'Add launch tile'} onClose={onClose} id="tile"
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save} data-testid="button-save-tile">Save tile</button></>}>
      <label className="field"><span>Name</span><input className="input" data-autofocus value={title} onInput={(e) => setTitle(val(e))} data-testid="input-tile-title" /></label>
      <label className="field"><span>HTTPS link</span><input className="input mono" value={url} aria-invalid={!!err} onInput={(e) => setUrl(val(e))} data-testid="input-tile-url" />
        <small>Opens in a new tab. LinkedIn and TikTok have no API access here, so tiles go straight to their official consoles.</small></label>
      <label className="field"><span>Platform</span>
        <select className="select" value={platform} onChange={(e) => setPlatform(val(e) as Tile['platform'])} data-testid="select-tile-platform">
          <option value="linkedin">LinkedIn</option><option value="tiktok">TikTok</option><option value="custom">Custom link</option>
        </select></label>
      {err && <div className="err" role="alert">{err}</div>}
    </Dialog>
  );
}

function Tiles({ tiles, onTiles }: { tiles: Tile[]; onTiles: (t: Tile[]) => void }) {
  const [edit, setEdit] = useState<Tile | null | undefined>(undefined);
  const [del, setDel] = useState<Tile | null>(null);
  const move = (i: number, d: number) => {
    const n = [...tiles]; const [t] = n.splice(i, 1); n.splice(i + d, 0, t!); onTiles(n);
  };
  return <>
    {tiles.length === 0 && <Empty icon={Rocket} title="No launch tiles" body="Add shortcuts to LinkedIn, TikTok Studio or any https console you check daily." />}
    {tiles.map((t, i) => (
      <div className="tile-wrap" key={t.id}>
        <a className="tile" href={t.url} target="_blank" rel="noopener noreferrer" data-testid={`link-tile-${t.id}`}>
          {t.platform === 'custom'
            ? <span className="tile-badge custom" aria-hidden="true">{initials(t.title)}</span>
            : <PlatformLogo platform={t.platform} size="medium" />}
          <span className="tile-txt"><b>{t.title}</b><small>{new URL(t.url).hostname}</small></span>
          <ArrowUpRight className="tile-go" />
        </a>
        <div className="tile-ctl">
          <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${t.title} up`}><ChevronUp /></button>
          <button className="icon-btn" disabled={i === tiles.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${t.title} down`}><ChevronDown /></button>
        </div>
        <div className="tile-ctl">
          <button className="icon-btn" onClick={() => setEdit(t)} aria-label={`Edit ${t.title}`} data-testid={`button-edit-tile-${t.id}`}><Pencil /></button>
          <button className="icon-btn" onClick={() => setDel(t)} aria-label={`Delete ${t.title}`} data-testid={`button-delete-tile-${t.id}`}><Trash2 /></button>
        </div>
      </div>
    ))}
    <button className="btn" onClick={() => setEdit(null)} data-testid="button-add-tile"><Plus /> Add tile</button>
    {edit !== undefined && <TileEditor tile={edit} onClose={() => setEdit(undefined)}
      onSave={(t) => onTiles(edit ? tiles.map((x) => (x.id === t.id ? t : x)) : [...tiles, t])} />}
    {del && <Confirm title="Delete tile?" danger confirmLabel="Delete" body={`Remove “${del.title}” from your launch tiles.`}
      onConfirm={() => onTiles(tiles.filter((x) => x.id !== del.id))} onClose={() => setDel(null)} />}
  </>;
}

export function filterComments(col: Column, data: DeckData): Comment[] {
  let list = data.comments;
  if (col.accountId) list = list.filter((c) => c.accountId === col.accountId);
  if (col.type === 'post' && col.postId) list = list.filter((c) => c.postId === col.postId);
  const rv = col.reviewed ?? (col.type === 'queue' ? 'unreviewed' : 'all');
  if (rv === 'reviewed') list = list.filter((c) => c.reviewed);
  if (rv === 'unreviewed') list = list.filter((c) => !c.reviewed);
  if (col.keyword?.trim()) {
    const k = col.keyword.trim().toLowerCase();
    list = list.filter((c) => c.text.toLowerCase().includes(k) || c.author.toLowerCase().includes(k));
  }
  if (col.type === 'post') {
    // thread order: by post, parents before replies
    const order = new Map(data.posts.map((p, i) => [p.id, i]));
    return [...list].sort((a, b) => (order.get(a.postId) ?? 0) - (order.get(b.postId) ?? 0)
      || ms(a.parentId ? (data.comments.find((x) => x.id === a.parentId)?.createdAt ?? a.createdAt) : a.createdAt) - ms(b.parentId ? (data.comments.find((x) => x.id === b.parentId)?.createdAt ?? b.createdAt) : b.createdAt)
      || (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
  }
  return [...list].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
}

interface ColProps {
  col: Column; index: number; total: number; data: DeckData; refreshing: boolean;
  onChange: (c: Column) => void; onMove: (d: number) => void; onRemove: () => void;
  onModerate: (c: Comment, a: ModAction, msg?: string) => Promise<void>; onReview: (c: Comment) => void;
  onTiles: (t: Tile[]) => void; onRefresh: () => void; isDemo: (id: string) => boolean;
}

export function DeckColumn(p: ColProps) {
  const { col, data } = p;
  const [editing, setEditing] = useState(false);
  const [rm, setRm] = useState(false);
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const Icon = ICONS[col.type];
  const items = useMemo(() => (col.type === 'launch' ? [] : filterComments(col, data)), [col, data]);
  const acc = data.accounts.find((a) => a.id === col.accountId);
  const post = data.posts.find((x) => x.id === col.postId);
  const set = (patch: Partial<Column>) => {
    const n = { ...col, ...patch } as Column;
    (Object.keys(n) as (keyof Column)[]).forEach((k) => { if (n[k] === '' || n[k] === undefined) delete n[k]; });
    p.onChange(n);
  };

  const touch = {
    onTouchStart: (e: TouchEvent) => { start.current = (body.current?.scrollTop ?? 1) <= 0 ? e.touches[0]!.clientY : null; },
    onTouchMove: (e: TouchEvent) => { if (start.current !== null) setPull(Math.max(0, Math.min(90, e.touches[0]!.clientY - start.current))); },
    onTouchEnd: () => { if (pull > 64) p.onRefresh(); setPull(0); start.current = null; },
  };

  const emptyCopy = (): [string, string] => {
    if (!data.accounts.length) return ['Nothing connected yet', 'Open Settings to add your Meta App ID and connect a Page, or try the labelled demo.'];
    if (col.keyword) return ['No matches', `Nothing here contains “${col.keyword}”. Loosen the filter to see more.`];
    if (col.type === 'queue') return ['Queue is clear', 'Every comment in view has been reviewed. New ones land here on refresh.'];
    if (col.type === 'post' && !col.postId) return ['No comments yet', 'Pick a specific post in this column’s filters to follow one thread.'];
    return ['Quiet for now', 'No comments match this column. Refresh to pull the latest 20 posts per account.'];
  };

  return (
    <section className="col" data-type={col.type} aria-labelledby={`h-${col.id}`} data-testid={`column-${col.id}`}>
      <header className="col-head">
        <div className="col-title">
          <span className="col-ico" aria-hidden="true"><Icon /></span>
          <h2 id={`h-${col.id}`}>{col.title}</h2>
          {col.type !== 'launch' && <span className="count" aria-label={`${items.length} items`}>{items.length}</span>}
          <div className="col-tools">
            <button className="icon-btn hide-sm" disabled={p.index === 0} onClick={() => p.onMove(-1)} aria-label="Move column left"><ChevronLeft /></button>
            <button className="icon-btn hide-sm" disabled={p.index === p.total - 1} onClick={() => p.onMove(1)} aria-label="Move column right"><ChevronRight /></button>
            <button className={`icon-btn${editing ? ' on' : ''}`} onClick={() => setEditing((x) => !x)} aria-expanded={editing} aria-label="Column filters" data-testid={`button-edit-column-${col.id}`}><SlidersHorizontal /></button>
            <button className="icon-btn" onClick={() => setRm(true)} aria-label="Remove column" data-testid={`button-remove-column-${col.id}`}><Trash2 /></button>
          </div>
        </div>
        {col.type !== 'launch' && (
          <div className="col-meta">
            <span className="chip">{acc?.name ?? 'All accounts'}</span>
            {col.type === 'post' && <span className="chip tide">{post ? `“${post.text.slice(0, 24)}…”` : 'All posts'}</span>}
            {col.reviewed && col.reviewed !== 'all' && <span className="chip">{col.reviewed}</span>}
            {col.keyword && <span className="chip flare">“{col.keyword}”</span>}
            {col.type === 'activity' && <span className="chip">local, newest first</span>}
          </div>
        )}
      </header>
      {editing && (
        <div className="col-edit">
          <label className="field"><span>Title</span><input className="input" value={col.title} onInput={(e) => set({ title: val(e) || TYPE_LABEL[col.type] })} data-testid={`input-column-title-${col.id}`} /></label>
          {col.type !== 'launch' && <>
            <div className="grid2">
              <label className="field"><span>Account</span>
                <select className="select" value={col.accountId ?? ''} onChange={(e) => set({ accountId: val(e), postId: undefined })} data-testid={`select-column-account-${col.id}`}>
                  <option value="">All accounts</option>
                  {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select></label>
              <label className="field"><span>Status</span>
                <select className="select" value={col.reviewed ?? (col.type === 'queue' ? 'unreviewed' : 'all')} onChange={(e) => set({ reviewed: val(e) as Column['reviewed'] })} data-testid={`select-column-reviewed-${col.id}`}>
                  <option value="all">All</option><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed</option>
                </select></label>
            </div>
            {col.type === 'post' && <label className="field"><span>Post</span>
              <select className="select" value={col.postId ?? ''} onChange={(e) => set({ postId: val(e) })} data-testid={`select-column-post-${col.id}`}>
                <option value="">All posts</option>
                {data.posts.filter((x) => !col.accountId || x.accountId === col.accountId).map((x) => <option key={x.id} value={x.id}>{ago(x.createdAt)} · {x.text.slice(0, 60) || '(no caption)'}</option>)}
              </select></label>}
            <label className="field"><span>Keyword</span><input className="input" type="search" value={col.keyword ?? ''} placeholder="Filter text or author" onInput={(e) => set({ keyword: val(e) })} data-testid={`input-column-keyword-${col.id}`} /></label>
          </>}
        </div>
      )}
      <div className="col-body" ref={body} {...touch}>
        <div className="ptr" style={{ height: pull ? `${pull * 0.5}px` : p.refreshing ? '28px' : 0 }} aria-hidden="true">
          <span className="row"><RefreshCw className={p.refreshing ? 'spin' : ''} style={{ transform: `rotate(${pull * 3}deg)` }} />{pull > 64 ? 'Release to refresh' : p.refreshing ? 'Refreshing' : 'Pull to refresh'}</span>
        </div>
        {col.type === 'launch' ? <Tiles tiles={data.tiles} onTiles={p.onTiles} />
          : data.loading && !items.length ? [0, 1, 2].map((i) => <div className="skel" key={i}><i /><i /><i /></div>)
          : items.length === 0 ? (() => { const [t, b] = emptyCopy(); return <Empty icon={Icon} title={t} body={b} />; })()
          : items.slice(0, 300).map((c) => <CommentCard key={c.id} c={c} data={data} isDemo={p.isDemo(c.id)} onModerate={p.onModerate} onReview={p.onReview} />)}
      </div>
      {rm && <Confirm title="Remove column?" confirmLabel="Remove" body={`“${col.title}” will be removed from your desk. No comments are deleted.`}
        onConfirm={p.onRemove} onClose={() => setRm(false)} />}
    </section>
  );
}

export function AddColumn({ onAdd }: { onAdd: (t: Column['type']) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="add-col" onClick={() => setOpen(true)} data-testid="button-add-column"><Plus /> Add column</button>
    {open && <Dialog title="Add a column" onClose={() => setOpen(false)} id="add-col">
      <div className="list">
        {(Object.keys(TYPE_LABEL) as Column['type'][]).map((t) => {
          const I = ICONS[t];
          return <button key={t} className="list-row" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid hsl(var(--line))', textAlign: 'left' }}
            onClick={() => { onAdd(t); setOpen(false); }} data-testid={`button-add-column-${t}`}>
            <span className="col-ico"><I /></span>
            <span className="grow"><b>{TYPE_LABEL[t]}</b><small>{{
              queue: 'Unreviewed comments across every account.',
              post: 'Threads with replies for one post or all posts.',
              activity: 'Recent comments and replies fetched to this device, newest first. Not a global mentions feed.',
              launch: 'Shortcuts to LinkedIn, TikTok and custom consoles.',
            }[t]}</small></span>
          </button>;
        })}
      </div>
    </Dialog>}
  </>;
}

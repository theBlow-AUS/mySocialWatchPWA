import type { Account, AuditEntry, Comment, Post } from '../core/types';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const val = (e: Event) => (e.target as HTMLInputElement).value;

export const ms = (t: number | string) => (typeof t === 'number' ? t : +new Date(t));

export function ago(t: number | string): string {
  const s = Math.max(0, (Date.now() - ms(t)) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ms(t)).toLocaleDateString();
}

export const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function isHttps(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && !!x.hostname && !x.username && !x.password;
  } catch {
    return false;
  }
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export function audit(action: string, detail: string, commentId?: string): AuditEntry {
  return { id: uid(), at: new Date().toISOString(), action, ...(commentId ? { commentId } : {}), detail };
}

export function passStrength(p: string): number {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 12) s++;
  if (p.length >= 18) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/[^A-Za-z]/.test(p)) s++;
  return Math.max(1, Math.min(4, s));
}

export interface DemoData {
  accounts: Account[];
  posts: Post[];
  comments: Comment[];
}

/** In-memory sample content for the opt-in demo. Never persisted, never sent anywhere. */
export function makeDemo(): DemoData {
  const now = Date.now();
  const m = (n: number) => new Date(now - n * 60000).toISOString();
  const accounts: Account[] = [
    { id: 'demo-acc-fb', name: 'Harbour Lane Bakery (sample)', platform: 'facebook', token: '', expiresAt: now + 864e5 * 50 },
    { id: 'demo-acc-ig', name: '@harbourlane.sample', platform: 'instagram', token: '', expiresAt: now + 864e5 * 50 },
  ];
  const posts: Post[] = [
    { id: 'demo-p1', accountId: 'demo-acc-fb', text: 'Sourdough Saturday is back — doors open 7:30 with the cardamom knots.', createdAt: m(410) },
    { id: 'demo-p2', accountId: 'demo-acc-ig', text: 'Behind the counter: 4am lamination for the spring croissant run.', createdAt: m(190) },
    { id: 'demo-p3', accountId: 'demo-acc-fb', text: 'We are hiring a weekend counter lead. Details in the comments.', createdAt: m(75) },
  ];
  const c = (id: string, postId: string, accountId: string, author: string, text: string, at: string, extra: Partial<Comment> = {}): Comment =>
    ({ id, postId, accountId, author, text, createdAt: at, hidden: false, reviewed: false, ...extra }) as Comment;
  const comments: Comment[] = [
    c('demo-c1', 'demo-p1', 'demo-acc-fb', 'Marisol Okafor', 'Are the cardamom knots dairy free? My son has an allergy.', m(6)),
    c('demo-c2', 'demo-p3', 'demo-acc-fb', 'Tobias Lindqvist', 'Is the counter lead role paid hourly or salary? Also is there a refund for last week’s cake order that never arrived?', m(14)),
    c('demo-c3', 'demo-p2', 'demo-acc-ig', 'crumbandcoast', 'Click my link for FREE followers and giveaway prizes!!', m(22)),
    c('demo-c4', 'demo-p2', 'demo-acc-ig', 'Priya Raman', 'This lamination is unreal. Do you run classes?', m(37)),
    c('demo-c5', 'demo-p1', 'demo-acc-fb', 'Wendell Ashby', 'Waited 40 minutes last Saturday, staff were rude. Want a refund.', m(58)),
    c('demo-c6', 'demo-p1', 'demo-acc-fb', 'Harbour Lane Bakery (sample)', 'Hi Marisol — they contain butter, but our oat loaf is dairy free.', m(4), { parentId: 'demo-c1', reviewed: true }),
    c('demo-c7', 'demo-p3', 'demo-acc-fb', 'Inés Carvalho', 'Sent my CV through the website form. Excited!', m(96), { reviewed: true }),
    c('demo-c8', 'demo-p2', 'demo-acc-ig', 'fernhill.eats', '@harbourlane.sample tagged you in our weekend pastry roundup', m(130)),
  ];
  return { accounts, posts, comments };
}

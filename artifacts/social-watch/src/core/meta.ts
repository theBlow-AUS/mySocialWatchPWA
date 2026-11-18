import type { Account, Comment, Post, Profile } from './types';

const GRAPH = 'https://graph.facebook.com';
let cooldownUntil = 0;
let pendingCallback: URLSearchParams | undefined;
let networkSession = new AbortController();
let requestAllowed = () => !document.hidden;
export function setMetaRequestGuard(guard: () => boolean): void {
  requestAllowed = guard;
}
export class MetaError extends Error {
  reauth: boolean;
  retryAt: number;
  constructor(message: string, reauth = false, retryAt = 0) {
    super(message);
    this.name = 'MetaError';
    this.reauth = reauth;
    this.retryAt = retryAt;
  }
}
// Remove OAuth material before rendering or any resource can observe the URL.
export function captureOAuthCallback(): void {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  if (fragment.has('access_token') || fragment.has('error') || query.has('error')) {
    pendingCallback = fragment.has('access_token') || fragment.has('error') ? fragment : query;
    history.replaceState(null, '', location.pathname);
  }
}
export function clearPendingOAuth(): void {
  pendingCallback = undefined;
  networkSession.abort();
  networkSession = new AbortController();
}
function validateVersion(version: string): void {
  if (!/^v\d{1,3}\.\d{1,2}$/.test(version)) throw new Error('Enter a Graph API version such as v27.0.');
}
export async function beginLogin(appId: string, apiVersion: string): Promise<void> {
  if (!/^\d{5,30}$/.test(appId)) throw new Error('Enter your own numeric Meta App ID in settings first.');
  validateVersion(apiVersion);
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const redirect = new URL(import.meta.env.BASE_URL, location.href).href;
  sessionStorage.setItem('social-watch-oauth', JSON.stringify({ state, at: Date.now() }));
  const url = new URL(`https://www.facebook.com/${apiVersion}/dialog/oauth`);
  url.search = new URLSearchParams({
    client_id: appId, redirect_uri: redirect, state, response_type: 'token',
    auth_type: 'rerequest',
    scope: 'pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_engagement,instagram_basic,instagram_manage_comments',
  }).toString();
  location.assign(url.href);
}
export async function finishLogin(): Promise<{ token: string; expiresAt: number } | null> {
  if (!pendingCallback) return null;
  const callback = pendingCallback;
  pendingCallback = undefined;
  const raw = sessionStorage.getItem('social-watch-oauth');
  sessionStorage.removeItem('social-watch-oauth');
  if (!raw) throw new MetaError('Login could not be verified. Please connect again.');
  let saved: { state: string; at: number };
  try { saved = JSON.parse(raw); } catch { throw new MetaError('Invalid login session. Please connect again.'); }
  if (callback.get('state') !== saved.state || Date.now() - saved.at > 15 * 60_000)
    throw new MetaError('Login expired or the security check failed. Please connect again.');
  if (callback.has('error')) throw new MetaError('Facebook Login was cancelled or permissions were declined.');
  const token = callback.get('access_token');
  const expires = Number(callback.get('expires_in'));
  if (!token || !Number.isFinite(expires) || expires <= 0)
    throw new MetaError('Facebook did not return a usable short-lived token. Please reconnect.');
  return { token, expiresAt: Date.now() + expires * 1000 };
}
interface GraphList<T> { data: T[]; paging?: { next?: string; cursors?: { after?: string } } }
type Raw = Record<string, any>;
async function request<T>(version: string, path: string, token: string, params: Record<string, string> = {}, method = 'GET'): Promise<T> {
  validateVersion(version);
  if (!requestAllowed()) throw new MetaError('Refresh paused: the profile is locked, idle, or inactive-tab refresh is off.');
  if (Date.now() < cooldownUntil)
    throw new MetaError('Meta rate limit reached. Refresh will resume after the cooldown.', false, cooldownUntil);
  const url = new URL(`${GRAPH}/${version}/${path}`);
  const init: RequestInit = {
    method, credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.any([AbortSignal.timeout(30000), networkSession.signal]),
  };
  if (method === 'GET') url.search = new URLSearchParams(params).toString();
  else if (method !== 'DELETE') init.body = new URLSearchParams(params);
  let response: Response;
  try { response = await fetch(url, init); }
  catch { throw new MetaError('Cannot reach Meta. Check your connection, browser restrictions, and app setup.'); }
  let payload: any;
  try { payload = await response.json(); }
  catch { throw new MetaError('Meta returned an unreadable response. Try again later.'); }
  const code = payload?.error?.code;
  if (code === 190 || code === 102 || response.status === 401)
    throw new MetaError('Your Meta session expired. Reconnect your accounts to continue.', true);
  if ([4, 17, 32, 613, 80004].includes(code) || response.status === 429) {
    const retry = Number(response.headers.get('retry-after'));
    cooldownUntil = Date.now() + Math.max(60, Math.min(Number.isFinite(retry) && retry > 0 ? retry : 300, 3600)) * 1000;
    throw new MetaError('Meta has limited requests. Please wait before refreshing again.', false, cooldownUntil);
  }
  if (!response.ok || payload?.error)
    throw new MetaError(code === 10 || code === 200
      ? 'Meta denied permission. Check app roles, Page access and requested permissions, then reconnect.'
      : `Meta could not complete this request${typeof code === 'number' ? ` (code ${code})` : ''}. Check permissions and API version.`);
  for (const header of ['x-app-usage', 'x-page-usage']) {
    try {
      const usage = JSON.parse(response.headers.get(header) || '{}');
      if (Object.values(usage).some(value => typeof value === 'number' && value >= 90))
        cooldownUntil = Date.now() + 60000;
    } catch { /* Header is optional and not available on every CORS response. */ }
  }
  return payload as T;
}
async function list<T>(version: string, path: string, token: string, fields: string, maxPages = 10): Promise<T[]> {
  const items: T[] = [];
  let after = '';
  for (let page = 0; page < maxPages; page++) {
    const result = await request<GraphList<T>>(version, path, token, { fields, limit: '100', ...(after ? { after } : {}) });
    if (!Array.isArray(result.data)) throw new MetaError('Meta returned an unexpected data format.');
    items.push(...result.data);
    if (!result.paging?.next || !result.paging.cursors?.after) break;
    if (page === maxPages - 1)
      throw new MetaError('This account exceeds the refresh safety limit. No partial refresh was saved. Use the native platform for its full history.');
    after = result.paging.cursors.after;
  }
  return items;
}
export async function discoverAccounts(token: string, expiresAt: number, apiVersion: string): Promise<Account[]> {
  const pages = await list<Raw>(apiVersion, 'me/accounts', token, 'id,name,access_token,instagram_business_account{id,username}');
  const accounts: Account[] = [];
  for (const page of pages) {
    if (!page.access_token) continue;
    accounts.push({ id: page.id, name: page.name, token: page.access_token, expiresAt, platform: 'facebook' });
    if (page.instagram_business_account?.id) accounts.push({
      id: page.instagram_business_account.id,
      name: page.instagram_business_account.username || `${page.name} · Instagram`,
      platform: 'instagram', pageId: page.id, token: page.access_token, expiresAt,
    });
  }
  if (!accounts.length) throw new MetaError('No accessible Pages found. Add your Facebook user as an app role and grant Page access, then reconnect.');
  return accounts;
}
function normalizeComment(raw: Raw, post: Post, account: Account, old: Map<string, Comment>, parentId?: string): Comment {
  return {
    id: raw.id, postId: post.id, accountId: account.id,
    author: raw.from?.name || raw.username || 'Platform user',
    text: raw.message || raw.text || '',
    createdAt: raw.created_time || raw.timestamp || new Date().toISOString(),
    hidden: !!(raw.is_hidden ?? raw.hidden), reviewed: old.get(raw.id)?.reviewed || false,
    ...(parentId ? { parentId } : {}),
  };
}
export async function refreshMeta(profile: Profile): Promise<{ posts: Post[]; comments: Comment[] }> {
  const version = profile.settings.apiVersion;
  const posts: Post[] = [], comments: Comment[] = [];
  const old = new Map(profile.comments.map(c => [c.id, c]));
  for (const account of profile.accounts) {
    if (account.expiresAt <= Date.now()) throw new MetaError('Your Meta session expired. Reconnect to refresh.', true);
    const instagram = account.platform === 'instagram';
    // Deliberately bounded recent-post window. All comments/replies in that window are paginated.
    const media = await request<GraphList<Raw>>(version, `${account.id}/${instagram ? 'media' : 'posts'}`, account.token, {
      fields: instagram ? 'id,caption,timestamp,permalink' : 'id,message,created_time,permalink_url', limit: '20',
    });
    for (const raw of media.data) {
      const post: Post = {
        id: raw.id, accountId: account.id, text: raw.message || raw.caption || 'Untitled post',
        createdAt: raw.created_time || raw.timestamp, permalink: raw.permalink_url || raw.permalink,
      };
      posts.push(post);
      const fields = instagram ? 'id,text,username,timestamp,hidden' : 'id,message,from,created_time,is_hidden';
      const top = await list<Raw>(version, `${post.id}/comments`, account.token, fields);
      for (const rawComment of top) {
        comments.push(normalizeComment(rawComment, post, account, old));
        const replies = await list<Raw>(version, `${rawComment.id}/${instagram ? 'replies' : 'comments'}`, account.token, fields);
        for (const reply of replies) comments.push(normalizeComment(reply, post, account, old, rawComment.id));
      }
    }
  }
  return { posts, comments: Array.from(new Map(comments.map(c => [c.id, c])).values()) };
}
export async function moderate(profile: Profile, comment: Comment, action: 'hide' | 'unhide' | 'delete' | 'reply', message?: string): Promise<void> {
  const account = profile.accounts.find(a => a.id === comment.accountId);
  if (!account) throw new MetaError('This account is no longer connected.');
  if (account.expiresAt <= Date.now()) throw new MetaError('Your Meta session expired. Reconnect to moderate.', true);
  const instagram = account.platform === 'instagram';
  if (action === 'reply' && !message?.trim()) throw new Error('Write a reply first.');
  const path = action === 'reply' ? `${comment.id}/${instagram ? 'replies' : 'comments'}` : comment.id;
  const params = action === 'reply'
    ? { message: message!.trim() }
    : action === 'hide' || action === 'unhide'
      ? { [instagram ? 'hide' : 'is_hidden']: String(action === 'hide') } : {};
  const result = await request<Raw | boolean>(profile.settings.apiVersion, path, account.token, params, action === 'delete' ? 'DELETE' : 'POST');
  if (result === false || (typeof result === 'object' && result.success === false))
    throw new MetaError('Meta did not confirm the moderation action. Refresh to check its status.');
}

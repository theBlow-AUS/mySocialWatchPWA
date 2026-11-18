import { z } from 'zod';

const id = z.string().max(512);
const text = z.string().max(100000);
export const AccountSchema = z.object({
  id, name: text, platform: z.enum(['facebook', 'instagram']),
  token: z.string().max(10000), expiresAt: z.number().nonnegative(), pageId: id.optional(),
});
export const PostSchema = z.object({
  id, accountId: id, text, createdAt: z.string(), permalink: z.string().optional(),
});
export const CommentSchema = z.object({
  id, postId: id, accountId: id, author: text, text, createdAt: z.string(),
  hidden: z.boolean(), reviewed: z.boolean(), parentId: id.optional(),
});
export const ColumnSchema = z.object({
  id, type: z.enum(['queue', 'post', 'activity', 'launch']), title: text,
  accountId: id.optional(), keyword: text.optional(),
  reviewed: z.enum(['all', 'reviewed', 'unreviewed']).optional(), postId: id.optional(),
});
export const TileSchema = z.object({
  id, title: z.string().min(1).max(200),
  url: z.string().url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, 'Use an HTTPS URL without credentials.'),
  platform: z.enum(['linkedin', 'tiktok', 'custom']),
});
export const AuditSchema = z.object({
  id, at: z.string(), action: text, commentId: id.optional(), detail: text,
});
export const NotificationPreferenceSchema = z.object({
  enabled: z.boolean(),
  comments: z.boolean(),
  replies: z.boolean(),
  watchlistOnly: z.boolean(),
});
export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;
export const ProfileSchema = z.object({
  version: z.literal(1),
  settings: z.object({
    appId: z.string().max(100),
    apiVersion: z.string().regex(/^v\d{1,3}\.\d{1,2}$/),
    idleMinutes: z.number().min(1).max(120),
    refreshSeconds: z.number().refine(n => n === 0 || (n >= 60 && n <= 3600)),
    theme: z.enum(['system', 'light', 'dark']),
    brandLogo: z.string().max(1_500_000).regex(/^data:image\/(?:png|jpeg|webp);base64,/).optional(),
    backgroundRefresh: z.boolean().optional(),
    notifications: z.record(z.string(), NotificationPreferenceSchema).optional(),
  }),
  accounts: z.array(AccountSchema).max(100),
  posts: z.array(PostSchema).max(20000),
  comments: z.array(CommentSchema).max(100000),
  columns: z.array(ColumnSchema).max(30),
  tiles: z.array(TileSchema).max(100),
  watchlist: z.array(z.string().min(1).max(200)).max(200),
  audit: z.array(AuditSchema).max(100000),
});
export type Account = z.infer<typeof AccountSchema>;
export type Post = z.infer<typeof PostSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Column = z.infer<typeof ColumnSchema>;
export type Tile = z.infer<typeof TileSchema>;
export type AuditEntry = z.infer<typeof AuditSchema>;
export type Profile = z.infer<typeof ProfileSchema>;

export function defaultProfile(): Profile {
  return {
    version: 1,
    settings: { appId: '', apiVersion: 'v27.0', idleMinutes: 15, refreshSeconds: 0, theme: 'system' },
    accounts: [], posts: [], comments: [], audit: [], watchlist: [],
    columns: [
      { id: 'queue', type: 'queue', title: 'Moderation queue', reviewed: 'unreviewed' },
      { id: 'posts', type: 'post', title: 'Post comments' },
      { id: 'activity', type: 'activity', title: 'Activity' },
      { id: 'launch', type: 'launch', title: 'Launch tiles' },
    ],
    tiles: [
      { id: 'linkedin', title: 'LinkedIn admin', url: 'https://www.linkedin.com/company/setup/admin/', platform: 'linkedin' },
      { id: 'tiktok', title: 'TikTok Studio', url: 'https://www.tiktok.com/tiktokstudio', platform: 'tiktok' },
    ],
  };
}

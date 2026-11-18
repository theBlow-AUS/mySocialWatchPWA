import { decrypt, encrypt } from './crypto.ts';
import { ProfileSchema, type Profile } from './types.ts';

export function portableProfile(profile: Profile): Profile {
  // This is a setup transfer, never a token/account-data synchronization mechanism.
  return ProfileSchema.parse({
    ...profile,
    settings: {
      ...profile.settings,
      ...(profile.settings.notifications ? { notifications: {} } : {}),
    },
    accounts: [], posts: [], comments: [], audit: [],
    columns: profile.columns.map(({ accountId: _account, postId: _post, ...column }) => column),
  });
}
export async function encodeProfile(profile: Profile, passphrase: string): Promise<string> {
  const { envelope } = await encrypt(portableProfile(profile), passphrase);
  return JSON.stringify(envelope);
}
export async function decodeProfile(serialized: string, passphrase: string): Promise<Profile> {
  if (serialized.length > 32_000_000) throw new Error('Profile exceeds the 24 MB import limit.');
  const { data } = await decrypt(JSON.parse(serialized), passphrase);
  return portableProfile(ProfileSchema.parse(data));
}

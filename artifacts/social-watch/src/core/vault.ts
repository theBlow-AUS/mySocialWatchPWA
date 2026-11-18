import { decrypt, encrypt, encryptWithKey, type Envelope } from './crypto.ts';
import { ProfileSchema, type Profile } from './types.ts';
import { encodeProfile, decodeProfile } from './profile-transfer.ts';

let activeKey: CryptoKey | undefined;
let activeSalt: string | undefined;
let generation = 0;
let writes: Promise<void> = Promise.resolve();
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open('social-watch-private', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vault');
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Device storage is blocked. Close other Social Watch tabs and try again.'));
    };
    request.onsuccess = () => {
      // A blocked request can succeed after its caller has already given up.
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(new Error('Cannot open device storage. Check browser privacy settings.'));
  });
}
async function storage<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest, beforeTransaction?: () => void): Promise<T> {
  const db = await openDb();
  try {
    // Opening IndexedDB is asynchronous too: locking must invalidate a save
    // here, not only before/after encryption.
    beforeTransaction?.();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('vault', mode);
      const request = operation(tx.objectStore('vault'));
      tx.oncomplete = () => resolve(request.result as T);
      tx.onabort = tx.onerror = () => reject(new Error('Device storage failed. Your latest changes were not saved.'));
    });
  } finally { db.close(); }
}
export async function hasVault(): Promise<boolean> {
  return !!await storage<Envelope | undefined>('readonly', s => s.get('profile'));
}
export async function createVault(passphrase: string, profile: Profile): Promise<void> {
  if (await hasVault()) throw new Error('A profile already exists. Unlock it or wipe this device first.');
  const validated = ProfileSchema.parse(profile);
  const { envelope, key } = await encrypt(validated, passphrase);
  // add, not put: two first-run tabs cannot overwrite one another.
  await storage('readwrite', s => s.add(envelope, 'profile'));
  generation++;
  activeKey = key;
  activeSalt = envelope.salt;
}
export async function unlockVault(passphrase: string): Promise<Profile> {
  const stored = await storage<Envelope | undefined>('readonly', s => s.get('profile'));
  if (!stored) throw new Error('No profile exists on this device yet.');
  const { data, key, envelope } = await decrypt(stored, passphrase);
  const profile = ProfileSchema.parse(data);
  generation++;
  activeKey = key;
  activeSalt = envelope.salt;
  return profile;
}
export function saveProfile(profile: Profile): Promise<void> {
  const validated = ProfileSchema.parse(profile);
  const key = activeKey, salt = activeSalt, version = generation;
  if (!key || !salt) return Promise.reject(new Error('Your profile is locked.'));
  const next = writes.catch(() => {}).then(async () => {
    if (version !== generation) throw new Error('Profile locked before changes could be saved.');
    const envelope = await encryptWithKey(validated, key, salt);
    if (version !== generation) throw new Error('Profile locked before changes could be saved.');
    await storage('readwrite', s => s.put(envelope, 'profile'), () => {
      if (version !== generation) throw new Error('Profile locked before changes could be saved.');
    });
  });
  writes = next;
  return next;
}
export function lockVault(): void {
  generation++;
  activeKey = undefined;
  activeSalt = undefined;
}
export async function wipeVault(): Promise<void> {
  lockVault();
  await writes.catch(() => {});
  await storage('readwrite', s => s.clear());
  sessionStorage.removeItem('social-watch-oauth');
}
export async function exportProfile(profile: Profile, passphrase: string): Promise<Blob> {
  return new Blob([await encodeProfile(profile, passphrase)], { type: 'application/octet-stream' });
}
export async function importProfile(file: File, passphrase: string): Promise<Profile> {
  if (file.size > 24_000_000) throw new Error('Profile exceeds the 24 MB import limit.');
  return decodeProfile(await file.text(), passphrase);
}
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface Envelope {
  format: 'social-watch';
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: 600000;
  salt: string;
  iv: string;
  ciphertext: string;
}
const encoder = new TextEncoder();
const AAD = encoder.encode('social-watch:1:PBKDF2-SHA256:600000');
export const ITERATIONS = 600000;
export function toBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192)
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
export function parseEnvelope(input: unknown): Envelope {
  if (!input || typeof input !== 'object') throw new Error('Not a Social Watch profile.');
  const v = input as Record<string, unknown>;
  if (v.format !== 'social-watch' || v.version !== 1 || v.kdf !== 'PBKDF2-SHA256' ||
      v.iterations !== ITERATIONS || typeof v.salt !== 'string' ||
      typeof v.iv !== 'string' || typeof v.ciphertext !== 'string' ||
      v.ciphertext.length > 32_000_000) throw new Error('Unsupported or invalid encrypted profile.');
  if (fromBase64(v.salt).length !== 16 || fromBase64(v.iv).length !== 12 ||
      fromBase64(v.ciphertext).length < 16) throw new Error('Invalid encrypted profile.');
  return v as unknown as Envelope;
}
export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}
export async function encryptWithKey(data: unknown, key: CryptoKey, salt: string): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AAD }, key, encoder.encode(JSON.stringify(data)),
  );
  return {
    format: 'social-watch', version: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS,
    salt, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}
export async function encrypt(data: unknown, passphrase: string): Promise<{ envelope: Envelope; key: CryptoKey }> {
  if (passphrase.length < 12) throw new Error('Use a passphrase of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  return { envelope: await encryptWithKey(data, key, toBase64(salt)), key };
}
export async function decrypt(input: unknown, passphrase: string): Promise<{ data: unknown; key: CryptoKey; envelope: Envelope }> {
  const envelope = parseEnvelope(input);
  const key = await deriveKey(passphrase, fromBase64(envelope.salt));
  try {
    const plaintext = await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: fromBase64(envelope.iv), additionalData: AAD,
    }, key, fromBase64(envelope.ciphertext));
    return { data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)), key, envelope };
  } catch {
    throw new Error('Incorrect passphrase or damaged profile.');
  }
}

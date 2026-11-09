// Teacher password hashing, shared by the browser and `npm run teacher-password`.
// Only a salted, slow hash ships with the site, never the password itself.

export interface PasswordHash { salt: string; hash: string }

const ITERATIONS = 200_000

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  // Stray spaces from autofill or a phone keyboard never count.
  const base = await crypto.subtle.importKey('raw', enc.encode(password.trim().normalize('NFC')), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: ITERATIONS }, base, 256)
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

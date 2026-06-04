export function id(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

export function inviteCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const COLORS = ['#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245', '#00d4ff', '#9b59b6', '#e67e22'];

export function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hash = new Uint8Array(derived);
  const combined = new Uint8Array(salt.length + hash.length);
  combined.set(salt);
  combined.set(hash, salt.length);
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const expected = combined.slice(16);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const actual = new Uint8Array(derived);
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export function rowToUser(row: Record<string, unknown>): import('./types').User {
  return {
    id: row.id as string,
    email: row.email as string,
    username: row.username as string,
    role: row.role as 'user' | 'admin',
    avatarColor: row.avatar_color as string,
    createdAt: row.created_at as number,
  };
}

export function publicUser(u: import('./types').User) {
  return { id: u.id, username: u.username, avatarColor: u.avatarColor, role: u.role };
}

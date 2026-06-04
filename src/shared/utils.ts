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
    displayName: (row.display_name as string | null) ?? null,
    role: row.role as 'user' | 'admin',
    avatarColor: row.avatar_color as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    bioExpiresAt: (row.bio_expires_at as number | null) ?? null,
    status: (row.status as string) || 'online',
    themeColor: (row.theme_color as string) || '#5865f2',
    themeMode: (row.theme_mode as string) || 'dark',
    nexusRole: (row.nexus_role as string | null) ?? null,
    nexusBadgeUrl: (row.nexus_badge_url as string | null) ?? null,
    developerBadgeUrl: (row.developer_badge_url as string | null) ?? null,
    createdAt: row.created_at as number,
  };
}

export function publicUser(u: import('./types').User) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarColor: u.avatarColor,
    avatarUrl: u.avatarUrl,
    role: u.role,
    nexusRole: u.nexusRole,
    nexusBadgeUrl: u.nexusBadgeUrl,
    developerBadgeUrl: u.developerBadgeUrl,
    status: u.status,
    bio: u.bio,
    bioExpiresAt: u.bioExpiresAt,
  };
}

export async function getMemberPermissions(
  db: D1Database,
  serverId: string,
  userId: string
): Promise<Record<string, boolean>> {
  const server = await db.prepare('SELECT owner_id FROM servers WHERE id = ?').bind(serverId).first();
  if (!server) return {};
  if (server.owner_id === userId) return { administrator: true };

  const roles = await db
    .prepare(
      `SELECT sr.permissions FROM role_members rm
       JOIN server_roles sr ON sr.id = rm.role_id
       WHERE rm.server_id = ? AND rm.user_id = ?`
    )
    .bind(serverId, userId)
    .all();

  const perms: Record<string, boolean> = {};
  for (const role of roles.results || []) {
    try {
      const rp = JSON.parse((role.permissions as string) || '{}');
      Object.assign(perms, rp);
    } catch { /* ignore */ }
  }
  return perms;
}

export async function hasPermission(
  db: D1Database,
  serverId: string,
  userId: string,
  perm: string
): Promise<boolean> {
  const perms = await getMemberPermissions(db, serverId, userId);
  return !!(perms.administrator || perms[perm]);
}

export async function addAuditLog(
  db: D1Database,
  serverId: string,
  actorId: string,
  actorName: string,
  action: string,
  opts?: {
    targetType?: string;
    targetId?: string;
    targetName?: string;
    details?: unknown;
  }
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO server_audit_log (id, server_id, actor_id, actor_name, action, target_type, target_id, target_name, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      id(),
      serverId,
      actorId,
      actorName,
      action,
      opts?.targetType ?? null,
      opts?.targetId ?? null,
      opts?.targetName ?? null,
      opts?.details != null ? JSON.stringify(opts.details) : null,
      now()
    )
    .run();
}

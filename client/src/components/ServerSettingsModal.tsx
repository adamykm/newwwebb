import './ServerSettingsModal.css';
import { useState, useEffect } from 'react';
import {
  api, type Server, type Channel, type ChannelCategory, type VoiceChannel,
  type ServerRole, type ServerMember, type Ban, type Mute, type AuditLogEntry,
  type RolePermissions, formatDateTime,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface Props {
  server: Server;
  categories: ChannelCategory[];
  channels: Channel[];
  voiceChannels: VoiceChannel[];
  roles: ServerRole[];
  members: ServerMember[];
  onClose: () => void;
  onUpdate: () => void;
}

type Tab = 'overview' | 'roles' | 'channels' | 'bans' | 'mutes' | 'audit';

const PERMISSIONS: { key: keyof RolePermissions; label: string }[] = [
  { key: 'administrator', label: 'Administrator (overrides all)' },
  { key: 'manageServer', label: 'Manage Server' },
  { key: 'manageChannels', label: 'Manage Channels' },
  { key: 'manageRoles', label: 'Manage Roles' },
  { key: 'manageMessages', label: 'Manage Messages' },
  { key: 'kickMembers', label: 'Kick Members' },
  { key: 'banMembers', label: 'Ban Members' },
  { key: 'muteMembers', label: 'Mute Members (Timeout)' },
  { key: 'sendMessages', label: 'Send Messages' },
  { key: 'viewChannels', label: 'View Channels' },
];

export default function ServerSettingsModal({
  server, categories, channels, voiceChannels, roles, members, onClose, onUpdate,
}: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Overview state
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description);
  const [iconColor, setIconColor] = useState(server.iconColor);
  const [iconUrl, setIconUrl] = useState(server.iconUrl || '');
  const [customInvite, setCustomInvite] = useState(server.customInvite || '');
  const [isDiscoverable, setIsDiscoverable] = useState(server.isDiscoverable || false);
  const [discoveryCategory, setDiscoveryCategory] = useState(server.discoveryCategory || '');

  // Roles state
  const [localRoles, setLocalRoles] = useState<ServerRole[]>(roles);
  const [editingRole, setEditingRole] = useState<ServerRole | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [rolePerms, setRolePerms] = useState<RolePermissions>({});
  const [roleColor, setRoleColor] = useState('#99aab5');
  const [roleHoist, setRoleHoist] = useState(false);
  const [roleMentionable, setRoleMentionable] = useState(false);

  // Channels state
  const [localCategories, setLocalCategories] = useState<ChannelCategory[]>(categories);
  const [localChannels, setLocalChannels] = useState<Channel[]>(channels);
  const [localVoice, setLocalVoice] = useState<VoiceChannel[]>(voiceChannels);
  const [newCatName, setNewCatName] = useState('');
  const [newChanName, setNewChanName] = useState('');
  const [newChanCatId, setNewChanCatId] = useState('');
  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceCatId, setNewVoiceCatId] = useState('');

  // Bans state
  const [bans, setBans] = useState<Ban[]>([]);
  const [banUserId, setBanUserId] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banTemp, setBanTemp] = useState(false);
  const [banDuration, setBanDuration] = useState('');

  // Mutes state
  const [mutes, setMutes] = useState<Mute[]>([]);

  // Audit log
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    if (tab === 'bans') api.moderation.getBans(server.id).then((r) => setBans(r.bans)).catch(() => {});
    if (tab === 'mutes') api.moderation.getMutes(server.id).then((r) => setMutes(r.mutes)).catch(() => {});
    if (tab === 'audit') api.moderation.getAuditLog(server.id).then((r) => setAuditEntries(r.entries)).catch(() => {});
  }, [tab, server.id]);

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
  };

  const saveOverview = async () => {
    setSaving(true);
    try {
      await api.servers.update(server.id, {
        name, description, iconColor, iconUrl: iconUrl || null, customInvite,
        isDiscoverable, discoveryCategory: discoveryCategory || undefined,
      });
      flash('Server settings saved!');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed to save', true); }
    setSaving(false);
  };

  const openRoleEditor = (role: ServerRole) => {
    setEditingRole(role);
    setRolePerms({ ...role.permissions });
    setRoleColor(role.color);
    setRoleHoist(role.hoist);
    setRoleMentionable(role.mentionable);
    setNewRoleName(role.name);
  };

  const saveRole = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      const updated = await api.roles.update(server.id, editingRole.id, {
        name: newRoleName, color: roleColor, hoist: roleHoist,
        mentionable: roleMentionable, permissions: rolePerms,
      });
      setLocalRoles((prev) => prev.map((r) => r.id === editingRole.id ? updated.role : r));
      setEditingRole(null);
      flash('Role saved!');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
    setSaving(false);
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setSaving(true);
    try {
      const { role } = await api.roles.create(server.id, { name: newRoleName.trim(), color: '#99aab5', permissions: {} });
      setLocalRoles((prev) => [...prev, role]);
      setNewRoleName('');
      flash('Role created!');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
    setSaving(false);
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Delete this role?')) return;
    try {
      await api.roles.delete(server.id, roleId);
      setLocalRoles((prev) => prev.filter((r) => r.id !== roleId));
      if (editingRole?.id === roleId) setEditingRole(null);
      flash('Role deleted');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const createCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const { category } = await api.servers.createCategory(server.id, newCatName);
      setLocalCategories((prev) => [...prev, category]);
      setNewCatName('');
      flash('Category created!');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const deleteCategory = async (catId: string) => {
    if (!confirm('Delete this category? Channels will become uncategorized.')) return;
    try {
      await api.servers.deleteCategory(server.id, catId);
      setLocalCategories((prev) => prev.filter((c) => c.id !== catId));
      setLocalChannels((prev) => prev.map((ch) => ch.categoryId === catId ? { ...ch, categoryId: null } : ch));
      setLocalVoice((prev) => prev.map((vc) => vc.categoryId === catId ? { ...vc, categoryId: null } : vc));
      flash('Category deleted');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const createChannel = async () => {
    if (!newChanName.trim()) return;
    try {
      const { channel } = await api.servers.createChannel(server.id, { name: newChanName, categoryId: newChanCatId || null });
      setLocalChannels((prev) => [...prev, channel]);
      setNewChanName('');
      flash('Channel created!');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const deleteChannel = async (channelId: string) => {
    if (!confirm('Delete this channel?')) return;
    try {
      await api.servers.deleteChannel(server.id, channelId);
      setLocalChannels((prev) => prev.filter((ch) => ch.id !== channelId));
      flash('Channel deleted');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const createVoice = async () => {
    if (!newVoiceName.trim()) return;
    try {
      const { voiceChannel } = await api.servers.createVoice(server.id, { name: newVoiceName, categoryId: newVoiceCatId || null });
      setLocalVoice((prev) => [...prev, voiceChannel]);
      setNewVoiceName('');
      flash('Voice channel created!');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const deleteVoice = async (vcId: string) => {
    if (!confirm('Delete this voice channel?')) return;
    try {
      await api.servers.deleteVoice(server.id, vcId);
      setLocalVoice((prev) => prev.filter((vc) => vc.id !== vcId));
      flash('Voice channel deleted');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const doAssignRole = async (targetUserId: string, roleId: string) => {
    try {
      await api.roles.assign(server.id, targetUserId, roleId);
      flash('Role assigned!');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const doBan = async () => {
    if (!banUserId.trim()) return;
    setSaving(true);
    try {
      let expiresAt: number | null = null;
      if (banTemp && banDuration) expiresAt = Date.now() + parseInt(banDuration) * 3600000;
      await api.moderation.ban(server.id, { userId: banUserId.trim(), reason: banReason, expiresAt });
      const updated = await api.moderation.getBans(server.id);
      setBans(updated.bans);
      setBanUserId(''); setBanReason(''); setBanTemp(false); setBanDuration('');
      flash('User banned');
      onUpdate();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
    setSaving(false);
  };

  const revokeBan = async (banId: string) => {
    try {
      await api.moderation.revokeBan(server.id, banId);
      setBans((prev) => prev.filter((b) => b.id !== banId));
      flash('Ban revoked');
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const doUnmute = async (muteId: string) => {
    try {
      await api.moderation.unmute(server.id, muteId);
      setMutes((prev) => prev.filter((m) => m.id !== muteId));
      flash('User unmuted');
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const ACTION_LABELS: Record<string, string> = {
    SERVER_UPDATED: '⚙ Server Updated', CATEGORY_CREATED: '📁 Category Created',
    CATEGORY_UPDATED: '📁 Category Updated', CATEGORY_DELETED: '📁 Category Deleted',
    CHANNEL_CREATED: '# Channel Created', CHANNEL_UPDATED: '# Channel Updated',
    CHANNEL_DELETED: '# Channel Deleted', VOICE_CHANNEL_CREATED: '🔊 Voice Channel Created',
    VOICE_CHANNEL_DELETED: '🔊 Voice Channel Deleted', ROLE_CREATED: '🎭 Role Created',
    ROLE_UPDATED: '🎭 Role Updated', ROLE_DELETED: '🎭 Role Deleted',
    ROLE_ASSIGNED: '🎭 Role Assigned', ROLE_REMOVED: '🎭 Role Removed',
    MEMBER_KICKED: '👢 Member Kicked', PERMANENT_BAN: '🔨 Member Banned (Permanent)',
    TEMP_BAN: '⏳ Member Banned (Temporary)', BAN_REVOKED: '✅ Ban Revoked',
    MEMBER_MUTED: '🔇 Member Muted', MEMBER_UNMUTED: '🔊 Member Unmuted',
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ss-modal">
        <div className="ss-sidebar">
          <div className="ss-server-info">
            <div className="ss-server-icon" style={{ background: server.iconColor }}>
              {server.iconUrl ? <img src={server.iconUrl} alt="" /> : server.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="ss-server-name">{server.name}</span>
          </div>
          <nav className="ss-tabs">
            {(['overview', 'roles', 'channels', 'bans', 'mutes', 'audit'] as Tab[]).map((t) => (
              <button key={t} className={`ss-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'overview' && '⚙ Overview'}
                {t === 'roles' && '🎭 Roles'}
                {t === 'channels' && '# Channels'}
                {t === 'bans' && '🔨 Bans'}
                {t === 'mutes' && '🔇 Mutes'}
                {t === 'audit' && '📋 Audit Log'}
              </button>
            ))}
          </nav>
          <button className="ss-close" onClick={onClose}>✕ Close</button>
        </div>

        <div className="ss-content">
          {error && <div className="ss-error">{error}</div>}
          {success && <div className="ss-success">{success}</div>}

          {/* ── Overview ──────────────────────────────────────────────────── */}
          {tab === 'overview' && (
            <div className="ss-section">
              <h2 className="ss-title">Server Overview</h2>
              <div className="ss-form">
                <div className="form-row">
                  <div className="ss-server-icon-big" style={{ background: iconColor }}>
                    {iconUrl ? <img src={iconUrl} alt="" /> : name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="form-col">
                    <label>Icon Color</label>
                    <input type="color" value={iconColor} onChange={(e) => setIconColor(e.target.value)} />
                  </div>
                </div>
                <label>Icon URL (optional)</label>
                <input placeholder="https://i.imgur.com/..." value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} />
                <label>Server Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
                <label>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
                <label>Custom Invite Code (optional)</label>
                <input placeholder="my-awesome-server" value={customInvite} onChange={(e) => setCustomInvite(e.target.value.toLowerCase())} maxLength={32} />
                <p className="hint">Default invite: {server.inviteCode}</p>

                <div className="ss-divider" />
                <h3>Server Discovery</h3>
                <label className="checkbox-label">
                  <input type="checkbox" checked={isDiscoverable} onChange={(e) => setIsDiscoverable(e.target.checked)} />
                  List this server in the Discovery tab
                </label>
                {isDiscoverable && (
                  <>
                    <label>Discovery Category</label>
                    <input placeholder="e.g. Gaming, Music, Art..." value={discoveryCategory} onChange={(e) => setDiscoveryCategory(e.target.value)} maxLength={50} />
                  </>
                )}

                <button className="btn btn-primary" onClick={saveOverview} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ── Roles ─────────────────────────────────────────────────────── */}
          {tab === 'roles' && (
            <div className="ss-section">
              <h2 className="ss-title">Roles</h2>
              {editingRole ? (
                <div className="role-editor">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingRole(null)}>← Back</button>
                  <h3 className="role-editor-title">Editing: {editingRole.name}</h3>
                  <label>Role Name</label>
                  <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} maxLength={50} />
                  <label>Color</label>
                  <input type="color" value={roleColor} onChange={(e) => setRoleColor(e.target.value)} />
                  <div className="role-toggles">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={roleHoist} onChange={(e) => setRoleHoist(e.target.checked)} />
                      Display members with this role separately
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={roleMentionable} onChange={(e) => setRoleMentionable(e.target.checked)} />
                      Allow anyone to @mention this role
                    </label>
                  </div>
                  <h4>Permissions</h4>
                  <div className="permissions-grid">
                    {PERMISSIONS.map((p) => (
                      <label key={p.key} className="checkbox-label perm-item">
                        <input
                          type="checkbox"
                          checked={!!rolePerms[p.key]}
                          onChange={(e) => setRolePerms((prev) => ({ ...prev, [p.key]: e.target.checked }))}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                  <div className="role-editor-actions">
                    <button className="btn btn-primary" onClick={saveRole} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Role'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteRole(editingRole.id)}>
                      Delete Role
                    </button>
                  </div>
                  <div className="ss-divider" />
                  <h4>Assign to members</h4>
                  <div className="member-assign-list">
                    {members.map((m) => {
                      const has = m.roles?.some((r) => r.id === editingRole.id);
                      return (
                        <div key={m.userId} className="member-assign-row">
                          <div className="avatar avatar-sm" style={{ background: m.avatarColor }}>
                            {(m.displayName || m.username)[0].toUpperCase()}
                          </div>
                          <span>{m.displayName || m.username}</span>
                          <button
                            className={`btn btn-sm ${has ? 'btn-danger' : 'btn-ghost'}`}
                            onClick={() => has
                              ? api.roles.remove(server.id, m.userId, editingRole.id).then(() => { flash('Role removed'); onUpdate(); })
                              : doAssignRole(m.userId, editingRole.id)
                            }
                          >
                            {has ? 'Remove' : 'Assign'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="roles-list">
                    {localRoles.map((role) => (
                      <div key={role.id} className="role-row" onClick={() => openRoleEditor(role)}>
                        <span className="role-color-dot" style={{ background: role.color }} />
                        <span className="role-name">{role.name}</span>
                        {role.hoist && <span className="role-tag">Hoisted</span>}
                        <span className="role-arrow">›</span>
                      </div>
                    ))}
                    {localRoles.length === 0 && (
                      <p className="empty-hint">No custom roles yet. Create one below.</p>
                    )}
                  </div>
                  <div className="create-role-row">
                    <input
                      placeholder="New role name"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      maxLength={50}
                      onKeyDown={(e) => e.key === 'Enter' && createRole()}
                    />
                    <button className="btn btn-primary btn-sm" onClick={createRole} disabled={saving}>
                      + Create
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Channels ──────────────────────────────────────────────────── */}
          {tab === 'channels' && (
            <div className="ss-section">
              <h2 className="ss-title">Channels &amp; Categories</h2>

              <h3>Categories</h3>
              <div className="channel-manage-list">
                {localCategories.map((cat) => (
                  <div key={cat.id} className="channel-manage-row">
                    <span className="cat-icon">📁</span>
                    <span className="channel-manage-name">{cat.name}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteCategory(cat.id)}>Delete</button>
                  </div>
                ))}
              </div>
              <div className="create-row">
                <input placeholder="Category name (supports any characters!)" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                <button className="btn btn-primary btn-sm" onClick={createCategory}>+ Category</button>
              </div>

              <div className="ss-divider" />
              <h3>Text Channels</h3>
              <div className="channel-manage-list">
                {localChannels.map((ch) => (
                  <div key={ch.id} className="channel-manage-row">
                    <span className="chan-icon">#</span>
                    <span className="channel-manage-name">{ch.name}</span>
                    <span className="channel-manage-cat">
                      {ch.categoryId ? localCategories.find((c) => c.id === ch.categoryId)?.name || '?' : 'No category'}
                    </span>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteChannel(ch.id)}>Delete</button>
                  </div>
                ))}
              </div>
              <div className="create-row">
                <input placeholder="Channel name" value={newChanName} onChange={(e) => setNewChanName(e.target.value)} />
                <select value={newChanCatId} onChange={(e) => setNewChanCatId(e.target.value)}>
                  <option value="">No category</option>
                  {localCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={createChannel}>+ Channel</button>
              </div>

              <div className="ss-divider" />
              <h3>Voice Channels</h3>
              <div className="channel-manage-list">
                {localVoice.map((vc) => (
                  <div key={vc.id} className="channel-manage-row">
                    <span className="chan-icon">🔊</span>
                    <span className="channel-manage-name">{vc.name}</span>
                    <span className="channel-manage-cat">
                      {vc.categoryId ? localCategories.find((c) => c.id === vc.categoryId)?.name || '?' : 'No category'}
                    </span>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteVoice(vc.id)}>Delete</button>
                  </div>
                ))}
              </div>
              <div className="create-row">
                <input placeholder="Voice channel name" value={newVoiceName} onChange={(e) => setNewVoiceName(e.target.value)} />
                <select value={newVoiceCatId} onChange={(e) => setNewVoiceCatId(e.target.value)}>
                  <option value="">No category</option>
                  {localCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={createVoice}>+ Voice</button>
              </div>
            </div>
          )}

          {/* ── Bans ──────────────────────────────────────────────────────── */}
          {tab === 'bans' && (
            <div className="ss-section">
              <h2 className="ss-title">Bans</h2>
              <div className="ban-form">
                <h3>Add Ban</h3>
                <div className="create-row">
                  <input placeholder="User ID to ban" value={banUserId} onChange={(e) => setBanUserId(e.target.value)} />
                  <input placeholder="Reason (optional)" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
                </div>
                <div className="ban-type-row">
                  <label className="checkbox-label">
                    <input type="radio" checked={!banTemp} onChange={() => setBanTemp(false)} />
                    Permanent ban
                  </label>
                  <label className="checkbox-label">
                    <input type="radio" checked={banTemp} onChange={() => setBanTemp(true)} />
                    Temporary ban
                  </label>
                  {banTemp && (
                    <input
                      type="number" placeholder="Duration in hours" min="1"
                      value={banDuration} onChange={(e) => setBanDuration(e.target.value)}
                      style={{ width: 180 }}
                    />
                  )}
                </div>
                <button className="btn btn-danger" onClick={doBan} disabled={saving || !banUserId}>
                  {saving ? 'Banning...' : '🔨 Ban User'}
                </button>
              </div>

              <div className="ss-divider" />
              <h3>Banned Users ({bans.length})</h3>
              {bans.length === 0 ? (
                <p className="empty-hint">No bans in this server.</p>
              ) : (
                <div className="ban-list">
                  {bans.map((ban) => (
                    <div key={ban.id} className="ban-row">
                      <div className="avatar avatar-sm" style={{ background: ban.avatarColor }}>{ban.username[0].toUpperCase()}</div>
                      <div className="ban-info">
                        <span className="ban-name">{ban.username}</span>
                        {ban.reason && <span className="ban-reason">"{ban.reason}"</span>}
                        <span className="ban-meta">
                          Banned by {ban.bannedByName} · {formatDateTime(ban.createdAt)}
                          {ban.expiresAt ? ` · Expires ${formatDateTime(ban.expiresAt)}` : ' · Permanent'}
                        </span>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => revokeBan(ban.id)}>Revoke</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Mutes ─────────────────────────────────────────────────────── */}
          {tab === 'mutes' && (
            <div className="ss-section">
              <h2 className="ss-title">Active Mutes / Timeouts</h2>
              {mutes.length === 0 ? (
                <p className="empty-hint">No active mutes.</p>
              ) : (
                <div className="ban-list">
                  {mutes.map((mute) => (
                    <div key={mute.id} className="ban-row">
                      <div className="avatar avatar-sm" style={{ background: mute.avatarColor }}>{mute.username[0].toUpperCase()}</div>
                      <div className="ban-info">
                        <span className="ban-name">{mute.username}</span>
                        {mute.reason && <span className="ban-reason">"{mute.reason}"</span>}
                        <span className="ban-meta">
                          Muted by {mute.mutedByName} · {formatDateTime(mute.mutedAt)}
                          {mute.expiresAt ? ` · Until ${formatDateTime(mute.expiresAt)}` : ' · Permanent'}
                        </span>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => doUnmute(mute.id)}>Unmute</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Audit Log ─────────────────────────────────────────────────── */}
          {tab === 'audit' && (
            <div className="ss-section">
              <h2 className="ss-title">Audit Log</h2>
              {auditEntries.length === 0 ? (
                <p className="empty-hint">No audit log entries yet.</p>
              ) : (
                <div className="audit-list">
                  {auditEntries.map((entry) => (
                    <div key={entry.id} className="audit-row">
                      <div className="audit-action">{ACTION_LABELS[entry.action] || entry.action}</div>
                      <div className="audit-by">by <strong>{entry.actorName}</strong></div>
                      {entry.targetName && <div className="audit-target">→ {entry.targetName}</div>}
                      <div className="audit-time">{formatDateTime(entry.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

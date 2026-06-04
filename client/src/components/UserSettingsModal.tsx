import './UserSettingsModal.css';
import { useState, useEffect } from 'react';
import { api, type User } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface Props {
  onClose: () => void;
}

type Tab = 'profile' | 'appearance' | 'voice';

const PRESET_COLORS = [
  '#5865f2', '#00d4ff', '#57f287', '#eb459e', '#fee75c',
  '#ed4245', '#ff6b35', '#9b59b6', '#e67e22', '#1abc9c',
];

export default function UserSettingsModal({ onClose }: Props) {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [bioExpiry, setBioExpiry] = useState<'24h' | 'permanent'>('permanent');
  const [status, setStatus] = useState(user?.status || 'online');

  const [themeColor, setThemeColor] = useState(user?.themeColor || '#5865f2');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(
    (user?.themeMode as 'dark' | 'light') || 'dark'
  );

  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [camDevices, setCamDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCam, setSelectedCam] = useState('');

  useEffect(() => {
    if (tab === 'voice') {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setMicDevices(devices.filter((d) => d.kind === 'audioinput'));
        setCamDevices(devices.filter((d) => d.kind === 'videoinput'));
      }).catch(() => {});
    }
  }, [tab]);

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { user: updated } = await api.profile.update({
        displayName: displayName.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        bio: bio.trim() || null,
        bioExpiry: bio.trim() ? bioExpiry : null,
        status,
      });
      updateUser(updated);
      flash('Profile saved!');
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
    setSaving(false);
  };

  const saveAppearance = async () => {
    setSaving(true);
    try {
      const { user: updated } = await api.profile.update({ themeColor, themeMode });
      updateUser(updated);
      flash('Appearance saved!');
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', true); }
    setSaving(false);
  };

  const STATUS_OPTIONS = [
    { value: 'online', label: '🟢 Online', color: 'var(--green)' },
    { value: 'idle', label: '🟡 Idle', color: 'var(--yellow)' },
    { value: 'dnd', label: '🔴 Do Not Disturb', color: 'var(--red)' },
    { value: 'invisible', label: '⚫ Invisible', color: 'var(--text-muted)' },
  ];

  const displayedName = displayName || user?.username || '';

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="us-modal">
        <div className="us-sidebar">
          <div className="us-sidebar-header">USER SETTINGS</div>
          <nav className="us-tabs">
            {(['profile', 'appearance', 'voice'] as Tab[]).map((t) => (
              <button key={t} className={`us-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'profile' && '👤 Profile'}
                {t === 'appearance' && '🎨 Appearance'}
                {t === 'voice' && '🎙 Voice & Video'}
              </button>
            ))}
          </nav>
          <button className="us-close" onClick={onClose}>✕ Close</button>
        </div>

        <div className="us-content">
          {error && <div className="us-error">{error}</div>}
          {success && <div className="us-success">{success}</div>}

          {/* ── Profile ─────────────────────────────────────────────────── */}
          {tab === 'profile' && (
            <div className="us-section">
              <h2 className="us-title">My Profile</h2>

              <div className="profile-preview">
                <div className="profile-preview-card">
                  <div className="pp-avatar">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" />
                    ) : (
                      <div style={{ background: user?.avatarColor, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 28, color: 'white' }}>
                        {displayedName[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className={`pp-status status-${status}`} />
                  </div>
                  <div className="pp-info">
                    <div className="pp-name">{displayedName}</div>
                    <div className="pp-username">@{user?.username}</div>
                    {bio && <div className="pp-bio">{bio}</div>}
                    <div className="pp-badges">
                      {user?.nexusRole === 'administrator' && (
                        <span className="badge-chip" title="Nexus Administrator">
                          {user.nexusBadgeUrl ? <img src={user.nexusBadgeUrl} alt="Admin" /> : '🛡'} Admin
                        </span>
                      )}
                      {user?.nexusRole === 'moderator' && (
                        <span className="badge-chip" title="Nexus Moderator">
                          {user.nexusBadgeUrl ? <img src={user.nexusBadgeUrl} alt="Mod" /> : '🔰'} Mod
                        </span>
                      )}
                      {user?.developerBadgeUrl && (
                        <span className="badge-chip" title="Developer">
                          <img src={user.developerBadgeUrl} alt="Dev" /> Dev
                        </span>
                      )}
                      {user?.role === 'admin' && (
                        <span className="badge-chip badge-owner" title="Nexus Owner">👑 Owner</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="us-form">
                <label>Display Name</label>
                <input
                  placeholder={user?.username}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={32}
                />
                <p className="hint">Your display name is shown instead of your username</p>

                <label>Avatar URL</label>
                <input placeholder="https://i.imgur.com/..." value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />

                <label>Status</label>
                <div className="status-options">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      className={`status-option ${status === s.value ? 'active' : ''}`}
                      onClick={() => setStatus(s.value)}
                      style={{ borderColor: status === s.value ? s.color : undefined }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <label>Bio</label>
                <textarea
                  placeholder="Tell people about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={190}
                  rows={3}
                />
                <div className="bio-expiry-row">
                  <label className="checkbox-label">
                    <input type="radio" checked={bioExpiry === 'permanent'} onChange={() => setBioExpiry('permanent')} />
                    Permanent
                  </label>
                  <label className="checkbox-label">
                    <input type="radio" checked={bioExpiry === '24h'} onChange={() => setBioExpiry('24h')} />
                    Temporary (expires in 24 hours)
                  </label>
                </div>

                <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          )}

          {/* ── Appearance ──────────────────────────────────────────────── */}
          {tab === 'appearance' && (
            <div className="us-section">
              <h2 className="us-title">Appearance</h2>
              <div className="us-form">
                <label>Theme Mode</label>
                <div className="theme-mode-row">
                  <button
                    className={`theme-mode-btn ${themeMode === 'dark' ? 'active' : ''}`}
                    onClick={() => setThemeMode('dark')}
                  >
                    🌙 Dark
                  </button>
                  <button
                    className={`theme-mode-btn ${themeMode === 'light' ? 'active' : ''}`}
                    onClick={() => setThemeMode('light')}
                  >
                    ☀ Light
                  </button>
                </div>

                <label>Accent Color</label>
                <div className="color-picker-row">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      className={`color-swatch ${themeColor === color ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => setThemeColor(color)}
                      title={color}
                    />
                  ))}
                  <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="color-custom-input" title="Custom color" />
                </div>

                <div className="theme-preview" style={{ '--preview-accent': themeColor } as React.CSSProperties}>
                  <div className="preview-label">Preview</div>
                  <div className="preview-bar" style={{ background: themeColor }} />
                  <div className="preview-button" style={{ background: themeColor }}>Button</div>
                </div>

                <button className="btn btn-primary" onClick={saveAppearance} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Appearance'}
                </button>
              </div>
            </div>
          )}

          {/* ── Voice & Video ────────────────────────────────────────────── */}
          {tab === 'voice' && (
            <div className="us-section">
              <h2 className="us-title">Voice &amp; Video</h2>
              <div className="us-form">
                <p className="hint">These settings apply in voice channels. Changes take effect immediately.</p>

                <label>Microphone</label>
                <select value={selectedMic} onChange={(e) => setSelectedMic(e.target.value)}>
                  <option value="">Default microphone</option>
                  {micDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
                  ))}
                </select>
                {micDevices.length === 0 && (
                  <p className="hint">No microphones detected. Allow microphone access to see devices.</p>
                )}

                <label>Camera</label>
                <select value={selectedCam} onChange={(e) => setSelectedCam(e.target.value)}>
                  <option value="">Default camera</option>
                  {camDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>
                  ))}
                </select>
                {camDevices.length === 0 && (
                  <p className="hint">No cameras detected. Allow camera access to see devices.</p>
                )}

                <div className="voice-info-box">
                  <p>🎙 To allow microphone and camera access, click the padlock icon in your browser's address bar and enable the permissions for this site.</p>
                </div>

                <label>Input Sensitivity</label>
                <p className="hint">Voice activity detection is automatic. You can mute/unmute yourself within voice channels.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

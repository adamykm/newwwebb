import './ServerPage.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  api, type Channel, type ChannelCategory, type VoiceChannel,
  type Message, type Server, type ServerMember, type ServerRole,
  formatTime, getDisplayName,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import ServerSettingsModal from '../components/ServerSettingsModal';
import VoiceChannelView from '../components/VoiceChannelView';

export default function ServerPage() {
  const { serverId } = useParams<{ serverId: string }>();
  const { user } = useAuth();

  const [server, setServer] = useState<Server | null>(null);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [voiceChannels, setVoiceChannels] = useState<VoiceChannel[]>([]);
  const [roles, setRoles] = useState<ServerRole[]>([]);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeVoice, setActiveVoice] = useState<VoiceChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const isOwner = server?.ownerId === user?.id;
  const isAdmin = user?.role === 'admin';

  const loadServer = useCallback(() => {
    if (!serverId) return;
    api.servers.get(serverId).then((r) => {
      setServer(r.server);
      setCategories(r.categories);
      setChannels(r.channels);
      setVoiceChannels(r.voiceChannels);
      setRoles(r.roles);
      setMembers(r.members);
      if (!activeChannel && r.channels.length) setActiveChannel(r.channels[0]);
    });
  }, [serverId]);

  const loadMessages = useCallback(async () => {
    if (!serverId || !activeChannel) return;
    const last = messages[messages.length - 1]?.createdAt;
    try {
      const res = await api.servers.messages(serverId, activeChannel.id, last);
      if (res.messages.length) {
        setMessages((prev) => [...prev, ...res.messages.filter((m) => !prev.some((p) => p.id === m.id))]);
      }
      if (res.isMuted !== undefined) setIsMuted(res.isMuted);
    } catch { /* ignore */ }
  }, [serverId, activeChannel, messages]);

  useEffect(() => { loadServer(); }, [serverId]);

  useEffect(() => {
    if (activeChannel) {
      setMessages([]);
      api.servers.messages(serverId!, activeChannel.id).then((r) => {
        setMessages(r.messages);
        if (r.isMuted !== undefined) setIsMuted(r.isMuted);
      });
    }
  }, [activeChannel?.id]);

  useEffect(() => {
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !serverId || !activeChannel) return;
    if (isMuted) return;
    try {
      const { message } = await api.servers.sendMessage(serverId, activeChannel.id, input.trim());
      setMessages((prev) => [...prev, message]);
      setInput('');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('muted')) setIsMuted(true);
    }
  };

  const copyInvite = () => {
    const code = server?.customInvite || server?.inviteCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleCategory = (catId: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  const switchToChannel = (ch: Channel) => {
    setActiveChannel(ch);
    setActiveVoice(null);
  };

  const joinVoice = (vc: VoiceChannel) => {
    setActiveVoice(vc);
    setActiveChannel(null);
  };

  if (!server) return <div className="loading-screen">Loading server...</div>;

  const uncategorized = channels.filter((ch) => !ch.categoryId);
  const uncategorizedVoice = voiceChannels.filter((vc) => !vc.categoryId);

  const hoistedRoles = roles.filter((r) => r.hoist);

  const membersByRole: { label: string; members: ServerMember[] }[] = [];

  if (hoistedRoles.length) {
    const assigned = new Set<string>();
    for (const role of [...hoistedRoles].sort((a, b) => b.position - a.position)) {
      const group = members.filter((m) =>
        m.roles?.some((r) => r.id === role.id) && !assigned.has(m.userId)
      );
      if (group.length) {
        group.forEach((m) => assigned.add(m.userId));
        membersByRole.push({ label: role.name, members: group });
      }
    }
    const rest = members.filter((m) => !assigned.has(m.userId));
    if (rest.length) membersByRole.push({ label: 'Members', members: rest });
  } else {
    membersByRole.push({ label: `Members — ${members.length}`, members });
  }

  return (
    <div className="server-page">
      {/* Channel Sidebar */}
      <aside className="channel-sidebar">
        <div className="channel-header">
          <div className="channel-header-top">
            <h2 className="server-name">{server.name}</h2>
            {(isOwner || isAdmin) && (
              <button className="settings-btn" onClick={() => setShowSettings(true)} title="Server Settings">⚙</button>
            )}
          </div>
          <button className="invite-btn btn btn-ghost btn-sm" onClick={copyInvite}>
            {copied ? '✓ Copied!' : `🔗 ${server.customInvite || server.inviteCode}`}
          </button>
        </div>

        <div className="channel-list">
          {/* Uncategorized channels */}
          {uncategorized.length > 0 && (
            <div className="channel-group">
              <span className="channel-category-label">TEXT CHANNELS</span>
              {uncategorized.map((ch) => (
                <button
                  key={ch.id}
                  className={`channel-item ${activeChannel?.id === ch.id ? 'active' : ''}`}
                  onClick={() => switchToChannel(ch)}
                >
                  <span className="channel-hash">#</span> {ch.name}
                </button>
              ))}
            </div>
          )}

          {uncategorizedVoice.length > 0 && (
            <div className="channel-group">
              <span className="channel-category-label">VOICE CHANNELS</span>
              {uncategorizedVoice.map((vc) => (
                <button
                  key={vc.id}
                  className={`channel-item voice-channel-item ${activeVoice?.id === vc.id ? 'active' : ''}`}
                  onClick={() => joinVoice(vc)}
                >
                  <span className="channel-voice-icon">🔊</span> {vc.name}
                  {vc.participants && vc.participants.length > 0 && (
                    <span className="vc-count">{vc.participants.length}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Categorized channels */}
          {categories.map((cat) => {
            const catChannels = channels.filter((ch) => ch.categoryId === cat.id);
            const catVoice = voiceChannels.filter((vc) => vc.categoryId === cat.id);
            const collapsed = collapsedCats.has(cat.id);
            if (catChannels.length === 0 && catVoice.length === 0) return null;
            return (
              <div key={cat.id} className="channel-group">
                <button className="channel-category-btn" onClick={() => toggleCategory(cat.id)}>
                  <span className={`cat-arrow ${collapsed ? 'collapsed' : ''}`}>›</span>
                  {cat.name}
                </button>
                {!collapsed && (
                  <>
                    {catChannels.map((ch) => (
                      <button
                        key={ch.id}
                        className={`channel-item ${activeChannel?.id === ch.id ? 'active' : ''}`}
                        onClick={() => switchToChannel(ch)}
                      >
                        <span className="channel-hash">#</span> {ch.name}
                      </button>
                    ))}
                    {catVoice.map((vc) => (
                      <button
                        key={vc.id}
                        className={`channel-item voice-channel-item ${activeVoice?.id === vc.id ? 'active' : ''}`}
                        onClick={() => joinVoice(vc)}
                      >
                        <span className="channel-voice-icon">🔊</span> {vc.name}
                        {vc.participants && vc.participants.length > 0 && (
                          <span className="vc-count">{vc.participants.length}</span>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main content */}
      {activeVoice ? (
        <VoiceChannelView
          serverId={serverId!}
          voiceChannel={activeVoice}
          user={user!}
          onLeave={() => { setActiveVoice(null); if (channels.length) setActiveChannel(channels[0]); }}
        />
      ) : (
        <div className="chat-area">
          <header className="chat-header">
            <span className="chat-header-name"># {activeChannel?.name || 'general'}</span>
          </header>

          <div className="chat-messages" ref={messagesRef}>
            {messages.length === 0 ? (
              <div className="chat-welcome">
                <div className="chat-welcome-icon">💬</div>
                <h2>Welcome to #{activeChannel?.name}</h2>
                <p>This is the beginning of the channel. Say hello!</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const prev = messages[i - 1];
                const grouped = prev && prev.userId === msg.userId && msg.createdAt - prev.createdAt < 300000;
                const name = msg.displayName || msg.username;
                return (
                  <div key={msg.id} className={`chat-message ${msg.userId === user?.id ? 'own' : ''} ${grouped ? 'grouped' : ''}`}>
                    {!grouped && (
                      <div className="avatar avatar-sm" style={{ background: msg.avatarColor || '#5865f2' }}>
                        {(name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    {grouped && <div className="avatar-placeholder" />}
                    <div className="message-body">
                      {!grouped && (
                        <div className="message-meta">
                          <span className="message-author">{name}</span>
                          <span className="message-time">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}
                      <p>{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form className="chat-input-bar" onSubmit={send}>
            {isMuted ? (
              <div className="muted-notice">🔇 You are muted in this server</div>
            ) : (
              <>
                <input
                  placeholder={`Message #${activeChannel?.name || 'general'}`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={2000}
                />
                <button type="submit" className="btn btn-primary btn-sm">Send</button>
              </>
            )}
          </form>
        </div>
      )}

      {/* Member Sidebar */}
      <aside className="member-sidebar">
        {membersByRole.map((group) => (
          <div key={group.label} className="member-group">
            <span className="member-category">{group.label.toUpperCase()} — {group.members.length}</span>
            {group.members.map((m) => {
              const topRole = m.roles?.sort((a, b) => b.position - a.position)[0];
              const name = m.displayName || m.username;
              return (
                <div key={m.userId} className="member-item">
                  <div className="member-avatar-wrap">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={name} className="avatar avatar-sm avatar-img" />
                    ) : (
                      <div className="avatar avatar-sm" style={{ background: m.avatarColor }}>
                        {name[0].toUpperCase()}
                      </div>
                    )}
                    <span className={`status-dot status-${m.status || 'online'}`} />
                    {m.isMuted && <span className="muted-icon" title="Muted">🔇</span>}
                  </div>
                  <div className="member-info">
                    <span className="member-name" style={{ color: topRole?.color }}>
                      {name}
                    </span>
                    {m.userId === server.ownerId && <span className="owner-crown" title="Server Owner">👑</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </aside>

      {showSettings && (
        <ServerSettingsModal
          server={server}
          categories={categories}
          channels={channels}
          voiceChannels={voiceChannels}
          roles={roles}
          members={members}
          onClose={() => setShowSettings(false)}
          onUpdate={() => loadServer()}
        />
      )}
    </div>
  );
}

import './ServerPage.css';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Channel, type Message, type Server, type ServerMember, formatTime } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export default function ServerPage() {
  const { serverId } = useParams<{ serverId: string }>();
  const { user } = useAuth();
  const [server, setServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadServer = () => {
    if (!serverId) return;
    api.servers.get(serverId).then((r) => {
      setServer(r.server);
      setChannels(r.channels);
      setMembers(r.members);
      if (!activeChannel && r.channels.length) setActiveChannel(r.channels[0]);
    });
  };

  const loadMessages = async () => {
    if (!serverId || !activeChannel) return;
    const last = messages[messages.length - 1]?.createdAt;
    const { messages: msgs } = await api.servers.messages(serverId, activeChannel.id, last);
    if (msgs.length) setMessages((prev) => [...prev, ...msgs.filter((m) => !prev.some((p) => p.id === m.id))]);
  };

  useEffect(() => { loadServer(); }, [serverId]);
  useEffect(() => {
    if (activeChannel) {
      setMessages([]);
      api.servers.messages(serverId!, activeChannel.id).then((r) => setMessages(r.messages));
    }
  }, [activeChannel?.id]);

  useEffect(() => {
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [serverId, activeChannel?.id, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !serverId || !activeChannel) return;
    const { message } = await api.servers.sendMessage(serverId, activeChannel.id, input.trim());
    setMessages((prev) => [...prev, message]);
    setInput('');
  };

  const copyInvite = () => {
    if (server?.inviteCode) {
      navigator.clipboard.writeText(server.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!server) return <div className="loading-screen">Loading server...</div>;

  return (
    <div className="server-page">
      <aside className="channel-sidebar">
        <div className="channel-header">
          <h2>{server.name}</h2>
          <button className="btn btn-ghost btn-sm" onClick={copyInvite} title="Copy invite code">
            {copied ? 'Copied!' : `# ${server.inviteCode}`}
          </button>
        </div>
        <div className="channel-list">
          <span className="channel-category">TEXT CHANNELS</span>
          {channels.map((ch) => (
            <button
              key={ch.id}
              className={`channel-item ${activeChannel?.id === ch.id ? 'active' : ''}`}
              onClick={() => setActiveChannel(ch)}
            >
              # {ch.name}
            </button>
          ))}
        </div>
      </aside>

      <div className="chat-area">
        <header className="chat-header">
          <span># {activeChannel?.name || 'general'}</span>
        </header>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <h2>Welcome to #{activeChannel?.name}</h2>
              <p>This is the start of the channel. Say hello!</p>
            </div>
          ) : messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.userId === user?.id ? 'own' : ''}`}>
              <div className="avatar avatar-sm" style={{ background: msg.avatarColor || '#5865f2' }}>
                {msg.username?.[0]?.toUpperCase()}
              </div>
              <div className="message-body">
                <span className="message-author">{msg.username}</span>
                <span className="message-time">{formatTime(msg.createdAt)}</span>
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="chat-input-bar" onSubmit={send}>
          <input
            placeholder={`Message #${activeChannel?.name || 'general'}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
          />
          <button type="submit" className="btn btn-primary btn-sm">Send</button>
        </form>
      </div>

      <aside className="member-sidebar">
        <span className="member-category">MEMBERS — {members.length}</span>
        {members.map((m) => (
          <div key={m.userId} className="member-item">
            <div className="avatar avatar-sm" style={{ background: m.avatarColor }}>{m.username[0].toUpperCase()}</div>
            <span>{m.username}</span>
          </div>
        ))}
      </aside>
    </div>
  );
}

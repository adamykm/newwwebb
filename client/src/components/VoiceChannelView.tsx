import './VoiceChannelView.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import { api, type VoiceChannel, type VoiceParticipant, type User } from '../lib/api';

interface Props {
  serverId: string;
  voiceChannel: VoiceChannel;
  user: User;
  onLeave: () => void;
}

interface PeerState {
  pc: RTCPeerConnection;
  stream?: MediaStream;
}

const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function VoiceChannelView({ serverId, voiceChannel, user, onLeave }: Props) {
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Record<string, HTMLVideoElement | null>>({});
  const peersRef = useRef<Record<string, PeerState>>({});
  const signalPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSignalTimeRef = useRef<number>(0);
  const sessionIdRef = useRef<string>('');

  const createPeer = useCallback(
    async (remoteUserId: string, isInitiator: boolean) => {
      if (peersRef.current[remoteUserId]) return;

      const pc = new RTCPeerConnection(STUN);
      peersRef.current[remoteUserId] = { pc };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        peersRef.current[remoteUserId].stream = stream;
        const vid = remoteVideosRef.current[remoteUserId];
        if (vid) vid.srcObject = stream;
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await api.servers.sendSignal(serverId, voiceChannel.id, {
            type: 'ice-candidate',
            data: JSON.stringify(event.candidate),
            toUserId: remoteUserId,
          });
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await api.servers.sendSignal(serverId, voiceChannel.id, {
          type: 'offer',
          data: JSON.stringify(offer),
          toUserId: remoteUserId,
        });
      }

      return pc;
    },
    [serverId, voiceChannel.id]
  );

  const handleSignal = useCallback(
    async (sig: { fromUserId: string; type: string; data: string }) => {
      const { fromUserId, type, data } = sig;
      let peer = peersRef.current[fromUserId];

      if (type === 'offer') {
        if (!peer) {
          await createPeer(fromUserId, false);
          peer = peersRef.current[fromUserId];
        }
        if (!peer) return;
        const offer = JSON.parse(data);
        await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        await api.servers.sendSignal(serverId, voiceChannel.id, {
          type: 'answer',
          data: JSON.stringify(answer),
          toUserId: fromUserId,
        });
      } else if (type === 'answer') {
        if (!peer) return;
        await peer.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data)));
      } else if (type === 'ice-candidate') {
        if (!peer) return;
        try { await peer.pc.addIceCandidate(new RTCIceCandidate(JSON.parse(data))); } catch { /* ignore */ }
      }
    },
    [createPeer, serverId, voiceChannel.id]
  );

  const joinVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const { participants: ps, sessionId } = await api.servers.joinVoice(serverId, voiceChannel.id);
      sessionIdRef.current = sessionId;
      setParticipants(ps);
      setJoined(true);

      for (const p of ps) {
        if (p.userId !== user.id) await createPeer(p.userId, true);
      }

      signalPollerRef.current = setInterval(async () => {
        try {
          const { signals } = await api.servers.voiceSignals(serverId, voiceChannel.id, lastSignalTimeRef.current);
          for (const sig of signals) {
            lastSignalTimeRef.current = Math.max(lastSignalTimeRef.current, sig.createdAt);
            await handleSignal(sig);
          }

          const { participants: updated } = await api.servers.voiceParticipants(serverId, voiceChannel.id);
          setParticipants(updated);

          const currentIds = new Set(updated.map((p) => p.userId));
          for (const uid of Object.keys(peersRef.current)) {
            if (!currentIds.has(uid)) {
              peersRef.current[uid].pc.close();
              delete peersRef.current[uid];
            }
          }
          for (const p of updated) {
            if (p.userId !== user.id && !peersRef.current[p.userId]) {
              await createPeer(p.userId, true);
            }
          }
        } catch { /* ignore */ }
      }, 1000);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not access microphone');
    }
  };

  const leaveVoice = async () => {
    if (signalPollerRef.current) clearInterval(signalPollerRef.current);
    Object.values(peersRef.current).forEach((p) => p.pc.close());
    peersRef.current = {};
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    await api.servers.leaveVoice(serverId, voiceChannel.id).catch(() => {});
    onLeave();
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMicEnabled((prev) => !prev);
  };

  const toggleCamera = async () => {
    if (!joined) return;
    if (cameraEnabled) {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => { t.stop(); localStreamRef.current!.removeTrack(t); });
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setCameraEnabled(false);
    } else {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({ video: true });
        const vt = vs.getVideoTracks()[0];
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(vt);
          for (const peer of Object.values(peersRef.current)) {
            const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(vt);
            else peer.pc.addTrack(vt, localStreamRef.current!);
          }
        }
        if (localVideoRef.current) {
          const videoOnlyStream = new MediaStream([vt]);
          localVideoRef.current.srcObject = videoOnlyStream;
        }
        setScreenSharing(false);
        setCameraEnabled(true);
      } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Camera error'); }
    }
  };

  const toggleScreenShare = async () => {
    if (!joined) return;
    if (screenSharing) {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => { t.stop(); localStreamRef.current!.removeTrack(t); });
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setScreenSharing(false);
    } else {
      try {
        const ds = await (navigator.mediaDevices as MediaDevices & { getDisplayMedia: (c: MediaStreamConstraints) => Promise<MediaStream> }).getDisplayMedia({ video: true });
        const vt = ds.getVideoTracks()[0];
        vt.onended = () => { setScreenSharing(false); if (localVideoRef.current) localVideoRef.current.srcObject = null; };
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(vt);
          for (const peer of Object.values(peersRef.current)) {
            const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(vt);
            else peer.pc.addTrack(vt, localStreamRef.current!);
          }
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = new MediaStream([vt]);
        setCameraEnabled(false);
        setScreenSharing(true);
      } catch { /* user cancelled */ }
    }
  };

  useEffect(() => {
    return () => {
      if (signalPollerRef.current) clearInterval(signalPollerRef.current);
      Object.values(peersRef.current).forEach((p) => p.pc.close());
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
      api.servers.leaveVoice(serverId, voiceChannel.id).catch(() => {});
    };
  }, [serverId, voiceChannel.id]);

  return (
    <div className="voice-view">
      <div className="voice-header">
        <span className="voice-title">🔊 {voiceChannel.name}</span>
        <span className="voice-sub">{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="voice-error">{error}</div>}

      {!joined ? (
        <div className="voice-join">
          <div className="voice-join-icon">🎙</div>
          <h2>Join {voiceChannel.name}</h2>
          <p>Your microphone will be used to communicate with others in this channel.</p>
          <button className="btn btn-primary" onClick={joinVoice}>Join Voice Channel</button>
        </div>
      ) : (
        <>
          <div className="voice-grid">
            <div className="voice-tile local-tile">
              {(cameraEnabled || screenSharing) ? (
                <video ref={localVideoRef} autoPlay muted playsInline className="voice-video" />
              ) : (
                <div className="voice-avatar" style={{ background: user.avatarColor }}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.username} />
                  ) : (
                    (user.displayName || user.username)[0].toUpperCase()
                  )}
                </div>
              )}
              <div className="voice-name-tag">
                {user.displayName || user.username} {!micEnabled && '🔇'}
                {screenSharing && ' 🖥'}
              </div>
            </div>

            {participants.filter((p) => p.userId !== user.id).map((p) => (
              <div key={p.userId} className="voice-tile">
                <video
                  autoPlay playsInline className="voice-video"
                  ref={(el) => { remoteVideosRef.current[p.userId] = el; if (el && peersRef.current[p.userId]?.stream) el.srcObject = peersRef.current[p.userId].stream!; }}
                  style={{ display: peersRef.current[p.userId]?.stream ? 'block' : 'none' }}
                />
                {!peersRef.current[p.userId]?.stream && (
                  <div className="voice-avatar" style={{ background: p.avatarColor }}>
                    {p.username[0].toUpperCase()}
                  </div>
                )}
                <div className="voice-name-tag">{p.username}</div>
              </div>
            ))}
          </div>

          <div className="voice-controls">
            <button
              className={`vc-btn ${!micEnabled ? 'vc-btn-off' : ''}`}
              onClick={toggleMic}
              title={micEnabled ? 'Mute' : 'Unmute'}
            >
              {micEnabled ? '🎙' : '🔇'}
            </button>
            <button
              className={`vc-btn ${cameraEnabled ? 'vc-btn-on' : ''}`}
              onClick={toggleCamera}
              title={cameraEnabled ? 'Stop Camera' : 'Start Camera'}
            >
              📷
            </button>
            <button
              className={`vc-btn ${screenSharing ? 'vc-btn-on' : ''}`}
              onClick={toggleScreenShare}
              title={screenSharing ? 'Stop Sharing' : 'Share Screen'}
            >
              🖥
            </button>
            <button className="vc-btn vc-btn-leave" onClick={leaveVoice} title="Leave Channel">
              📞
            </button>
          </div>
        </>
      )}
    </div>
  );
}

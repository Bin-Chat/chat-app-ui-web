import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Users,
  Phone,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { endCall, setMuted, setVideoOff, addParticipant } from '@/store/slices';
import { appSocket } from '@/services/appSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { chatServices } from '@/services/chatServices';
import UserAvatar from '@/components/UserAvatar';

// ── Voice activity detection ──────────────────────────────────────────────────
function useVoiceActivity(
  localStream: MediaStream | null,
  remoteStreams: Record<string, MediaStream>,
  localUserId: string | undefined
): Record<string, boolean> {
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const contexts: AudioContext[] = [];
    const timers: ReturnType<typeof setInterval>[] = [];

    const monitor = (userId: string, stream: MediaStream) => {
      try {
        const ctx = new AudioContext();
        contexts.push(ctx);
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const id = setInterval(() => {
          analyser.getByteFrequencyData(data);
          const avg = data.slice(2, 20).reduce((a, b) => a + b, 0) / 18;
          setSpeaking((prev) => {
            const val = avg > 12;
            if (prev[userId] === val) return prev;
            return { ...prev, [userId]: val };
          });
        }, 150);
        timers.push(id);
      } catch {
        /* ignore AudioContext errors */
      }
    };

    if (localStream && localUserId) monitor(localUserId, localStream);
    Object.entries(remoteStreams).forEach(([uid, s]) => monitor(uid, s));

    return () => {
      timers.forEach(clearInterval);
      contexts.forEach((c) => c.close().catch(() => {}));
    };
  }, [localStream, remoteStreams, localUserId]);

  return speaking;
}

/** A single video tile — shows stream or avatar fallback when camera is off */
function VideoTile({
  stream,
  label,
  muted = false,
  isLocal = false,
  className = '',
  forceContain = false,
}: {
  stream: MediaStream;
  label?: string;
  muted?: boolean;
  isLocal?: boolean;
  className?: string;
  /** Force object-contain (e.g. for screen shares) */
  forceContain?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [objectFit, setObjectFit] = useState<'cover' | 'contain'>(
    forceContain ? 'contain' : 'cover'
  );

  useEffect(() => {
    if (!ref.current || !stream) return;
    const video = ref.current;
    video.srcObject = stream;

    const checkVideo = () => {
      const alive = stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');
      setHasVideo(alive);
    };
    checkVideo();

    // Auto-detect screen share by aspect ratio after video loads
    const handleMetadata = () => {
      const v = ref.current;
      if (!v) return;
      if (v.videoWidth && v.videoHeight) {
        const ratio = v.videoWidth / v.videoHeight;
        // Typical webcams: 4:3 (1.33) or 16:9 (1.78)
        // Screen shares: usually wider than 1.6 AND high resolution
        // Use resolution threshold in addition to ratio for better accuracy
        const isWide = ratio > 1.6 && (v.videoWidth > 1280 || v.videoHeight > 720);
        setObjectFit(forceContain || isWide ? 'contain' : 'cover');
      }
    };
    video.addEventListener('loadedmetadata', handleMetadata);

    stream.addEventListener('addtrack', checkVideo);
    stream.addEventListener('removetrack', checkVideo);
    const tracks = stream.getVideoTracks();
    tracks.forEach((t) => t.addEventListener('ended', checkVideo));
    return () => {
      video.removeEventListener('loadedmetadata', handleMetadata);
      stream.removeEventListener('addtrack', checkVideo);
      stream.removeEventListener('removetrack', checkVideo);
      tracks.forEach((t) => t.removeEventListener('ended', checkVideo));
    };
  }, [stream, forceContain]);

  const initials = label
    ? label
        .split(' ')
        .slice(-2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#1e2130] select-none ${className}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full transition-opacity duration-200 ${
          objectFit === 'contain' ? 'object-contain bg-black' : 'object-cover'
        } ${hasVideo ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e2130]">
          <div className="w-14 h-14 rounded-full bg-[#3a4060] flex items-center justify-center text-xl font-bold text-white mb-2">
            {initials}
          </div>
          {label && <span className="text-gray-400 text-[11px]">{isLocal ? 'Bạn' : label}</span>}
        </div>
      )}
      {label && (
        <div className="absolute bottom-2 left-2">
          <span className="text-white text-[11px] bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md">
            {isLocal ? `Bạn` : label}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Participant Sidebar ────────────────────────────────────────────────────────
function RemoteAudioPlayer({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = ref.current;
    if (!audio || !stream) return;

    audio.srcObject = stream;
    audio.muted = false;
    audio.volume = 1;

    const play = () => {
      void audio.play().catch((err) => {
        console.warn('[CallRoom] remote audio autoplay blocked', err);
      });
    };

    play();
    audio.addEventListener('loadedmetadata', play);
    stream.addEventListener('addtrack', play);

    return () => {
      audio.removeEventListener('loadedmetadata', play);
      stream.removeEventListener('addtrack', play);
      audio.pause();
      audio.srcObject = null;
    };
  }, [stream]);

  return <audio ref={ref} autoPlay className="hidden" />;
}

function ParticipantSidebar({
  participantIds,
  currentUserId,
  nameForId,
  speaking,
  remoteStreams,
}: {
  participantIds: string[];
  currentUserId: string | undefined;
  nameForId: (id: string) => string;
  speaking: Record<string, boolean>;
  remoteStreams: Record<string, MediaStream>;
}) {
  return (
    <div className="w-52 flex-shrink-0 bg-[#181f2e] border-l border-white/5 flex flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-gray-500" />
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Thành viên &middot; {participantIds.length}
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1.5">
        {participantIds.map((uid) => {
          const isLocal = uid === currentUserId;
          const isSpeaking = speaking[uid] ?? false;
          const isInCall = isLocal || !!remoteStreams[uid];
          const name = isLocal ? 'Bạn' : nameForId(uid);

          return (
            <div
              key={uid}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all duration-150 ${
                isSpeaking ? 'bg-green-500/15' : 'hover:bg-white/5'
              }`}
            >
              <div className="relative flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full bg-[#3a4060] flex items-center justify-center text-[12px] font-bold text-white ${
                    isSpeaking ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-[#181f2e]' : ''
                  }`}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                {isSpeaking && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-green-400 animate-ping opacity-40 pointer-events-none" />
                )}
                {isInCall && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#181f2e]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-gray-200 truncate">{name}</p>
                <p className="text-[10px] truncate">
                  {isSpeaking ? (
                    <span className="text-green-400">Đang nói...</span>
                  ) : isInCall ? (
                    <span className="text-gray-500">Đang kết nối</span>
                  ) : (
                    <span className="text-gray-600">Chưa tham gia</span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Audio group call grid ─────────────────────────────────────────────────────
function AudioGroupView({
  participantIds,
  currentUserId,
  nameForId,
  speaking,
  timer,
}: {
  participantIds: string[];
  currentUserId: string | undefined;
  nameForId: (id: string) => string;
  speaking: Record<string, boolean>;
  timer: string;
}) {
  const colClass =
    participantIds.length <= 2
      ? 'grid-cols-2'
      : participantIds.length <= 4
        ? 'grid-cols-2'
        : participantIds.length <= 6
          ? 'grid-cols-3'
          : 'grid-cols-4';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 bg-gradient-to-b from-[#1a2035] to-[#111827]">
      <p className="text-green-400 text-[15px] font-mono">{timer}</p>
      <div className={`grid ${colClass} gap-4 w-full max-w-2xl`}>
        {participantIds.map((uid) => {
          const isLocal = uid === currentUserId;
          const isSpeaking = speaking[uid] ?? false;
          const name = isLocal ? 'Bạn' : nameForId(uid);
          return (
            <div
              key={uid}
              className={`flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200 ${
                isSpeaking ? 'bg-green-500/20 ring-2 ring-green-400/70' : 'bg-[#1e2130]'
              }`}
            >
              <div className="relative">
                <div
                  className={`w-16 h-16 rounded-full bg-[#3a4060] flex items-center justify-center text-2xl font-bold transition-all ${
                    isSpeaking ? 'ring-4 ring-green-400 ring-offset-2 ring-offset-[#1e2130]' : ''
                  }`}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                {isSpeaking && (
                  <span className="absolute inset-0 rounded-full ring-4 ring-green-400 animate-ping opacity-30 pointer-events-none" />
                )}
              </div>
              <p className="text-[13px] font-medium">{name}</p>
              {isSpeaking && <p className="text-[10px] text-green-400">Đang nói...</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Full-screen call overlay — supports audio/video 1-1 and group calls.
 * Group calls use a Google Meet–style spotlight + thumbnail strip layout.
 */
export default function CallRoom() {
  const dispatch = useAppDispatch();
  const call = useAppSelector((s) => s.call);
  const currentUser = useAppSelector((s) => s.auth.user);
  const friends = useAppSelector((s) => s.friend.friends);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // isScreenSharing is managed by Redux via useWebRTC dispatch — no local state needed
  const isScreenSharing = call.isScreenSharing;

  const {
    localStream,
    remoteStreams,
    screenSharingUsers,
    getLocalStream,
    enableVideoTrack,
    initiateOffer,
    startScreenShare,
    stopScreenShare,
    cleanup,
  } = useWebRTC();

  const isVideo = call.callType === 'video';

  // Voice activity detection — drives speaking indicators in sidebar / audio grid
  const voiceActivity = useVoiceActivity(localStream, remoteStreams, currentUser?.id);

  // ── Acquire local media on mount ─────────────────────────────────────
  useEffect(() => {
    getLocalStream(isVideo).catch(() => {
      if (isVideo) getLocalStream(false).catch(console.error);
    });
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (call.status === 'connected') {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [call.status]);

  // ── Helpers — declared first so they can be used in effects below ────
  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const nameForId = useCallback(
    (id: string) =>
      id === currentUser?.id
        ? (currentUser.fullName ?? 'Bạn')
        : (friends.find((f) => f.user.id === id)?.user.fullName ?? id.slice(0, 8)),
    [currentUser, friends]
  );

  // ── Wire call:accepted → initiate WebRTC offer to the new joiner ─────
  useEffect(() => {
    const onCallAccepted = (payload: { callId: string; userId: string }) => {
      if (payload.callId !== call.callId) return;
      dispatch(addParticipant(payload.userId));
      initiateOffer(payload.userId);
    };
    appSocket.on('call:accepted', onCallAccepted);
    return () => {
      appSocket.off('call:accepted', onCallAccepted);
    };
  }, [call.callId, dispatch, initiateOffer]);

  // ── Group call: notify chat when someone joins or rejects ────────────
  useEffect(() => {
    if (!call.conversationId || call.initiatorId !== currentUser?.id) return;

    const onJoinNotify = (payload: { callId: string; userId: string }) => {
      if (payload.callId !== call.callId) return;
      if (call.participantIds.length <= 2) return; // only group calls
      const name = nameForId(payload.userId);
      void chatServices
        .sendMessage(call.conversationId!, {
          content: `${name} đã tham gia cuộc gọi`,
          type: 'system',
        })
        .catch(console.error);
    };

    const onRejectNotify = (payload: { callId: string; userId: string }) => {
      if (payload.callId !== call.callId) return;
      const name = nameForId(payload.userId);
      void chatServices
        .sendMessage(call.conversationId!, {
          content: `${name} đã từ chối cuộc gọi`,
          type: 'system',
        })
        .catch(console.error);
    };

    appSocket.on('call:accepted', onJoinNotify);
    appSocket.on('call:rejected', onRejectNotify);
    return () => {
      appSocket.off('call:accepted', onJoinNotify);
      appSocket.off('call:rejected', onRejectNotify);
    };
  }, [
    call.callId,
    call.conversationId,
    call.initiatorId,
    call.participantIds.length,
    currentUser?.id,
    nameForId,
  ]);

  // ── Hang up ──────────────────────────────────────────────────────────
  const handleHangUp = useCallback(() => {
    if (call.callId) {
      if (call.initiatorId === currentUser?.id && call.conversationId) {
        const prefix = call.callType === 'video' ? '[VIDEO]' : '[VOICE]';
        const label = call.callType === 'video' ? 'video' : 'thoại';
        const content =
          call.status === 'connected'
            ? `${prefix} Cuộc gọi ${label} - ${formatTime(elapsed)}`
            : `${prefix} Cuộc gọi ${label} bị hủy`;
        void chatServices
          .sendMessage(call.conversationId, { content, type: 'system' })
          .catch(console.error);
      }
      appSocket.emit('call:end', { callId: call.callId });
    }
    cleanup();
    dispatch(endCall());
  }, [call, currentUser, elapsed, cleanup, dispatch]);

  const handleToggleMute = useCallback(
    () => dispatch(setMuted(!call.isMuted)),
    [call.isMuted, dispatch]
  );

  // Video toggle: supports switching audio→video mid-call
  const handleToggleVideo = useCallback(async () => {
    if (call.isVideoOff) {
      const hasLiveVideo =
        localStream?.getVideoTracks().some((t) => t.readyState === 'live') ?? false;
      if (!hasLiveVideo) {
        try {
          await enableVideoTrack();
        } catch {
          return;
        }
      }
      dispatch(setVideoOff(false));
    } else {
      dispatch(setVideoOff(true));
    }
  }, [call.isVideoOff, localStream, enableVideoTrack, dispatch]);

  // Screen share — Redux isScreenSharing is updated by the hook automatically
  const handleToggleScreen = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        await startScreenShare();
      } catch {
        /* user cancelled */
      }
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  // ── Derived ──────────────────────────────────────────────────────────
  const remoteEntries = Object.entries(remoteStreams);
  const isGroup = call.participantIds.length > 2;
  // Show video layout when remote is sending video, even if local cam is off
  const remoteHasVideo = remoteEntries.some(([, stream]) =>
    stream.getVideoTracks().some((t) => t.readyState === 'live')
  );
  // Show sidebar whenever there's at least 1 tracked participant
  // (handles callee case where participantIds starts with just [callerId])
  const showSidebar = call.participantIds.length >= 1;

  const calleeNames = call.participantIds
    .filter((id) => id !== currentUser?.id)
    .map((id) => nameForId(id))
    .join(', ');

  const statusLabel =
    call.status === 'connected'
      ? formatTime(elapsed)
      : call.status === 'calling'
        ? 'Đang gọi…'
        : 'Đang kết nối…';

  // ── Controls ─────────────────────────────────────────────────────────
  const controls = (
    <div className="flex items-center justify-center gap-4 pb-8 pt-3 flex-shrink-0">
      <ControlBtn
        onClick={handleToggleMute}
        active={call.isMuted}
        label={call.isMuted ? 'Bật mic' : 'Tắt mic'}
        icon={call.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      />
      <ControlBtn
        onClick={handleToggleVideo}
        active={call.isVideoOff}
        label={call.isVideoOff ? 'Bật camera' : 'Tắt camera'}
        icon={call.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
      />
      <ControlBtn
        onClick={handleToggleScreen}
        active={false}
        highlight={isScreenSharing}
        label={isScreenSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}
        icon={
          isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />
        }
      />
      <button
        onClick={handleHangUp}
        title="Kết thúc cuộc gọi"
        className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 text-white
                   flex items-center justify-center transition-all shadow-lg"
      >
        <PhoneOff className="w-6 h-6" />
      </button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9998] flex flex-col bg-[#111827] text-white">
      {remoteEntries.map(([uid, stream]) => (
        <RemoteAudioPlayer key={`audio-${uid}`} stream={stream} />
      ))}

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2">
          {isVideo ? (
            <Video className="w-4 h-4 text-blue-400" />
          ) : (
            <Phone className="w-4 h-4 text-green-400" />
          )}
          <span className="text-[13px] text-gray-300 font-medium">
            {isGroup ? `Cuộc gọi nhóm · ${call.participantIds.length} người` : calleeNames}
          </span>
        </div>
        <span
          className={`text-[13px] font-mono ${
            call.status === 'connected' ? 'text-green-400' : 'text-yellow-400 animate-pulse'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-h-0 relative">
          {/* ── AUDIO CALL waiting (no remote, local cam off) ────────── */}
          {call.isVideoOff &&
            remoteEntries.length === 0 &&
            !isScreenSharing &&
            (isGroup ? (
              <AudioGroupView
                participantIds={call.participantIds}
                currentUserId={currentUser?.id}
                nameForId={nameForId}
                speaking={voiceActivity}
                timer={statusLabel}
              />
            ) : (
              <AudioWaitingView calleeNames={calleeNames} status={call.status} />
            ))}
          {/* ── AUDIO connected (no remote video, no screen share) ─────── */}
          {call.isVideoOff &&
            remoteEntries.length > 0 &&
            !remoteHasVideo &&
            !isScreenSharing &&
            (isGroup ? (
              <AudioGroupView
                participantIds={call.participantIds}
                currentUserId={currentUser?.id}
                nameForId={nameForId}
                speaking={voiceActivity}
                timer={formatTime(elapsed)}
              />
            ) : (
              <AudioConnectedView
                remoteId={remoteEntries[0][0]}
                nameForId={nameForId}
                timer={formatTime(elapsed)}
              />
            ))}

          {/* ── VIDEO view: local cam on OR remote sending video OR screen sharing ─ */}
          {(!call.isVideoOff || remoteHasVideo || isScreenSharing) && (
            <>
              {remoteEntries.length === 0 && (
                <WaitingView
                  calleeNames={calleeNames}
                  status={call.status}
                  localStream={localStream}
                  localName={currentUser?.fullName}
                />
              )}
              {remoteEntries.length === 1 && (
                <div className="absolute inset-0 p-2">
                  <VideoTile
                    stream={remoteEntries[0][1]}
                    label={nameForId(remoteEntries[0][0])}
                    muted
                    forceContain={screenSharingUsers[remoteEntries[0][0]] ?? false}
                    className="w-full h-full"
                  />
                  {/* Local PiP — hidden when screen sharing (no point showing cam) */}
                  {localStream && !call.isVideoOff && !isScreenSharing && (
                    <div className="absolute bottom-4 right-4 w-32 h-44 z-10 rounded-2xl overflow-hidden shadow-xl ring-2 ring-white/20">
                      <VideoTile
                        stream={localStream}
                        label="Bạn"
                        muted
                        isLocal
                        className="h-full"
                      />
                    </div>
                  )}
                </div>
              )}
              {remoteEntries.length >= 2 && (
                <GroupLayout
                  remoteEntries={remoteEntries}
                  localStream={localStream}
                  nameForId={nameForId}
                  localName={currentUser?.fullName ?? 'Bạn'}
                  isScreenSharing={isScreenSharing}
                  screenSharingUsers={screenSharingUsers}
                />
              )}
            </>
          )}
        </div>

        {/* Participant sidebar — shown for group/multi-person calls */}
        {showSidebar && (
          <ParticipantSidebar
            participantIds={call.participantIds}
            currentUserId={currentUser?.id}
            nameForId={nameForId}
            speaking={voiceActivity}
            remoteStreams={remoteStreams}
          />
        )}
      </div>

      {controls}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────

function ControlBtn({
  onClick,
  active,
  highlight = false,
  label,
  icon,
}: {
  onClick: () => void;
  active: boolean;
  highlight?: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 ${
        active
          ? 'bg-red-500/90 text-white shadow-md'
          : highlight
            ? 'bg-blue-500/90 text-white shadow-md'
            : 'bg-[#2d3748] text-white hover:bg-[#3d4a5c]'
      }`}
    >
      {icon}
    </button>
  );
}

function AudioWaitingView({ calleeNames, status }: { calleeNames: string; status: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#1a2035] to-[#111827]">
      <div className="w-28 h-28 rounded-full bg-[#2d3748] flex items-center justify-center text-4xl font-bold">
        {calleeNames.charAt(0).toUpperCase()}
      </div>
      <p className="text-xl font-semibold">{calleeNames}</p>
      <p className={`text-sm text-gray-400 ${status !== 'connected' ? 'animate-pulse' : ''}`}>
        {status === 'calling'
          ? 'Đang gọi…'
          : status === 'ringing'
            ? 'Đang đổ chuông…'
            : 'Đang kết nối…'}
      </p>
    </div>
  );
}

function AudioConnectedView({
  remoteId,
  nameForId,
  timer,
}: {
  remoteId: string;
  nameForId: (id: string) => string;
  timer: string;
}) {
  const name = nameForId(remoteId);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#1a2035] to-[#111827]">
      <UserAvatar src={undefined} name={name} size={100} />
      <p className="text-xl font-semibold">{name}</p>
      <p className="text-green-400 text-[15px] font-mono">{timer}</p>
    </div>
  );
}

function WaitingView({
  calleeNames,
  status,
  localStream,
  localName,
}: {
  calleeNames: string;
  status: string;
  localStream: MediaStream | null;
  localName?: string;
}) {
  return (
    <div className="absolute inset-0">
      {localStream ? (
        <VideoTile stream={localStream} muted isLocal className="w-full h-full" />
      ) : (
        <div className="w-full h-full bg-[#1a2035]" />
      )}
      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-4">
        <div className="w-20 h-20 rounded-full bg-[#3a4060]/80 flex items-center justify-center text-2xl font-bold">
          {calleeNames.charAt(0).toUpperCase()}
        </div>
        <p className="text-lg font-semibold">{calleeNames}</p>
        <p className={`text-sm text-gray-300 ${status !== 'connected' ? 'animate-pulse' : ''}`}>
          {status === 'calling' ? 'Đang gọi…' : 'Đang kết nối…'}
        </p>
        {localName && (
          <span className="absolute bottom-4 left-4 text-[11px] bg-black/50 px-2 py-0.5 rounded-md text-gray-300">
            Bạn ({localName})
          </span>
        )}
      </div>
    </div>
  );
}

/** Google Meet–style: spotlight + thumbnail strip, with per-tile fullscreen zoom */
function GroupLayout({
  remoteEntries,
  localStream,
  nameForId,
  localName,
  isScreenSharing,
  screenSharingUsers,
}: {
  remoteEntries: [string, MediaStream][];
  localStream: MediaStream | null;
  nameForId: (id: string) => string;
  localName: string;
  isScreenSharing: boolean;
  screenSharingUsers: Record<string, boolean>;
}) {
  const [spotlightId, setSpotlightId] = useState<string>(remoteEntries[0]?.[0] ?? '');
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  const spotlight = remoteEntries.find(([id]) => id === spotlightId) ?? remoteEntries[0];
  const thumbnails = remoteEntries.filter(([id]) => id !== spotlight?.[0]);

  // Auto-spotlight whoever is screen sharing
  useEffect(() => {
    const sharingEntry = remoteEntries.find(([uid]) => screenSharingUsers[uid]);
    if (sharingEntry) setSpotlightId(sharingEntry[0]);
  }, [remoteEntries, screenSharingUsers]);

  // ── Fullscreen overlay (any tile can be maximized) ────────────────
  if (fullscreenId) {
    const fsEntry = remoteEntries.find(([id]) => id === fullscreenId);
    if (fsEntry) {
      return (
        <div className="absolute inset-0 z-20 bg-black rounded-2xl overflow-hidden">
          <VideoTile
            stream={fsEntry[1]}
            label={nameForId(fsEntry[0])}
            muted
            forceContain={screenSharingUsers[fsEntry[0]] ?? false}
            className="w-full h-full"
          />
          <button
            onClick={() => setFullscreenId(null)}
            title="Thu nhỏ"
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <Minimize2 className="w-4 h-4 text-white" />
          </button>
        </div>
      );
    }
  }

  // ── 2 remotes → equal split with zoom buttons ─────────────────────
  if (remoteEntries.length === 2) {
    return (
      <div className="absolute inset-0 p-2 grid grid-cols-2 gap-2">
        {remoteEntries.map(([uid, stream]) => (
          <div key={uid} className="relative h-full group">
            <VideoTile
              stream={stream}
              label={nameForId(uid)}
              muted
              forceContain={screenSharingUsers[uid] ?? false}
              className="h-full"
            />
            <button
              onClick={() => setFullscreenId(uid)}
              title="Phóng to"
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100"
            >
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        ))}
        {localStream && !isScreenSharing && (
          <div className="absolute bottom-4 right-4 w-28 h-36 z-10 rounded-2xl overflow-hidden shadow-xl ring-2 ring-white/20">
            <VideoTile stream={localStream} label={localName} muted isLocal className="h-full" />
          </div>
        )}
      </div>
    );
  }

  // ── 3+ remotes → spotlight + horizontal thumbnail strip ───────────
  return (
    <div className="absolute inset-0 flex flex-col p-2 gap-2">
      {/* Spotlight */}
      <div className="flex-1 min-h-0 relative group">
        {spotlight && (
          <>
            <VideoTile
              stream={spotlight[1]}
              label={nameForId(spotlight[0])}
              muted
              forceContain={screenSharingUsers[spotlight[0]] ?? false}
              className="w-full h-full"
            />
            <button
              onClick={() => setFullscreenId(spotlight[0])}
              title="Phóng to"
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100"
            >
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
          </>
        )}
      </div>
      {/* Thumbnail strip */}
      <div className="h-28 flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
        {thumbnails.map(([uid, stream]) => (
          <button
            key={uid}
            onClick={() => setSpotlightId(uid)}
            title={nameForId(uid)}
            className={`flex-shrink-0 w-36 h-full rounded-xl overflow-hidden focus:outline-none transition-all ring-2 ${
              uid === spotlight?.[0] ? 'ring-blue-400' : 'ring-transparent hover:ring-blue-400/60'
            }`}
          >
            <VideoTile
              stream={stream}
              label={nameForId(uid)}
              muted
              forceContain={screenSharingUsers[uid] ?? false}
              className="h-full"
            />
          </button>
        ))}
        {localStream && !isScreenSharing && (
          <div className="flex-shrink-0 w-36 h-full rounded-xl overflow-hidden ring-2 ring-blue-500/40">
            <VideoTile stream={localStream} label={localName} muted isLocal className="h-full" />
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { appSocket } from '@/services/appSocket';
import { setCallConnected, setScreenSharing } from '@/store/slices';

// Gate that resolves when getLocalStream() succeeds.
// Used by the callee to avoid answering an offer before local tracks are ready.
interface StreamReadyGate {
  promise: Promise<MediaStream>;
  resolve: (s: MediaStream) => void;
  resolved: boolean;
}

// ICE server configuration — STUN (public) + TURN (local coturn)
const makeIceConfig = (): RTCConfiguration => ({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: `turn:${window.location.hostname}:3478`,
      username: import.meta.env.VITE_TURN_USERNAME ?? 'chatapp',
      credential: import.meta.env.VITE_TURN_PASSWORD ?? 'chatapp_turn_secret',
    },
  ],
});

interface SignalPayload {
  callId: string;
  senderId: string;
  signal: {
    type: 'offer' | 'answer' | 'ice-candidate' | 'screen_share_status';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    sharing?: boolean;
  };
}

/**
 * Manages WebRTC peer connections for mesh group/direct calling.
 *
 * Usage:
 *  1. Call `getLocalStream(video, audio)` once to capture media.
 *  2. Caller side: call `initiateOffer(remoteUserId)` for each accepted participant.
 *  3. `handleSignal` is wired automatically via socket `call:signal`.
 *  4. On unmount / call end → call `cleanup()`.
 */
export function useWebRTC() {
  const dispatch = useAppDispatch();
  const callId = useAppSelector((s) => s.call.callId);
  const isMuted = useAppSelector((s) => s.call.isMuted);
  const isVideoOff = useAppSelector((s) => s.call.isVideoOff);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // remoteUserId → their MediaStream
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  // userId → whether they are screen sharing (populated via signaling)
  const [screenSharingUsers, setScreenSharingUsers] = useState<Record<string, boolean>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // remoteUserId → RTCPeerConnection
  const pcMap = useRef<Map<string, RTCPeerConnection>>(new Map());
  // Buffer ICE candidates arriving before remote desc is set
  const iceCandidateBuffer = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // callId snapshot used inside callbacks
  const callIdRef = useRef<string | null>(null);
  callIdRef.current = callId;
  // Snapshot of isVideoOff for use inside callbacks (avoids stale closure)
  const isVideoOffRef = useRef(isVideoOff);
  isVideoOffRef.current = isVideoOff;

  // ── Stream readiness gate ────────────────────────────────────────────────
  // A promise that resolves when getLocalStream() completes.
  // The callee must await this before answering an offer to ensure local
  // tracks are added — otherwise the answer has no media (race condition).
  const localStreamReady = useRef<StreamReadyGate | null>(null);
  if (!localStreamReady.current) {
    let resolve!: (s: MediaStream) => void;
    const promise = new Promise<MediaStream>((r) => {
      resolve = r;
    });
    localStreamReady.current = { promise, resolve, resolved: false };
  }

  // ── Sync mute / video state to track enabled flags ──────────────────────
  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted;
    });
  }, [isMuted]);

  useEffect(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !isVideoOff;
    });
  }, [isVideoOff]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection(makeIceConfig());

      // Add local tracks to the new connection
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Relay ICE candidates via socket
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && callIdRef.current) {
          appSocket.emit('call:signal', {
            callId: callIdRef.current,
            targetUserId: remoteUserId,
            signal: { type: 'ice-candidate', candidate: candidate.toJSON() },
          });
        }
      };

      // Receive remote tracks
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) {
          setRemoteStreams((prev) => ({ ...prev, [remoteUserId]: stream }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          dispatch(setCallConnected());
        } else if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'closed'
        ) {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[remoteUserId];
            return next;
          });
        }
      };

      // Renegotiate when new tracks are added mid-call (e.g. switching audio→video)
      // Guard: only when a remote description already exists (established call)
      pc.onnegotiationneeded = async () => {
        if (!pc.remoteDescription || !callIdRef.current) return;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          appSocket.emit('call:signal', {
            callId: callIdRef.current,
            targetUserId: remoteUserId,
            signal: { type: 'offer', sdp: pc.localDescription },
          });
        } catch (err) {
          console.warn('[useWebRTC] onnegotiationneeded error', err);
        }
      };

      pcMap.current.set(remoteUserId, pc);
      return pc;
    },
    [dispatch]
  );

  // ── Public API ───────────────────────────────────────────────────────────

  /** Request user media and store the stream. Must be called before offers. */
  const getLocalStream = useCallback(async (video: boolean, audio = true) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
    localStreamRef.current = stream;
    setLocalStream(stream);
    // Resolve the readiness gate so callee can proceed with WebRTC answer
    if (localStreamReady.current && !localStreamReady.current.resolved) {
      localStreamReady.current.resolved = true;
      localStreamReady.current.resolve(stream);
    }
    return stream;
  }, []);

  const setCameraEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      if (localStreamRef.current) {
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
      return;
    }

    let videoTrack = localStreamRef.current
      ?.getVideoTracks()
      .find((track) => track.readyState === 'live');

    if (!videoTrack) {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) return;

      if (localStreamRef.current) {
        localStreamRef.current.addTrack(videoTrack);
      } else {
        localStreamRef.current = videoStream;
      }
    }

    videoTrack.enabled = true;

    await Promise.all(
      Array.from(pcMap.current.values()).map(async (pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(videoTrack);
        } else {
          pc.addTrack(videoTrack!, localStreamRef.current!);
        }
      })
    );

    if (localStreamRef.current) {
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }
  }, []);

  /**
   * Acquire a video track and add it to all active peer connections.
   * Triggers renegotiation via onnegotiationneeded.
   * Used when switching from an audio call to video mid-call.
   */
  const enableVideoTrack = useCallback(async () => {
    await setCameraEnabled(true);
  }, [setCameraEnabled]);

  /**
   * Caller-side: create an offer and send it to a specific remote participant.
   * Called when a remote participant emits call:accepted.
   */
  const initiateOffer = useCallback(
    async (remoteUserId: string) => {
      if (localStreamReady.current && !localStreamReady.current.resolved) {
        await Promise.race([
          localStreamReady.current.promise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('stream timeout')), 10_000)
          ),
        ]).catch(() =>
          console.warn('[useWebRTC] local stream not ready in 10s - creating offer without media')
        );
      }

      const pc = createPeerConnection(remoteUserId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      if (callIdRef.current) {
        appSocket.emit('call:signal', {
          callId: callIdRef.current,
          targetUserId: remoteUserId,
          signal: { type: 'offer', sdp: pc.localDescription },
        });
      }
    },
    [createPeerConnection]
  );

  /**
   * Handle an incoming WebRTC signal (offer / answer / ice-candidate).
   * Automatically wired to the socket `call:signal` event.
   */
  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (payload.callId !== callIdRef.current) return;
      const { senderId, signal } = payload;

      let pc = pcMap.current.get(senderId);
      if (!pc) {
        pc = createPeerConnection(senderId);
      }

      if (signal.type === 'offer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        // Flush buffered ICE candidates
        const buffered = iceCandidateBuffer.current.get(senderId) ?? [];
        for (const c of buffered) await pc.addIceCandidate(new RTCIceCandidate(c));
        iceCandidateBuffer.current.delete(senderId);

        // ── FIX: wait for local stream before answering ──────────────────
        // getUserMedia is async (~500ms-2s). The offer often arrives before
        // it resolves (race condition). Without waiting, the answer contains
        // no local tracks → remote side receives no media → "Đang chờ…" forever.
        if (localStreamReady.current && !localStreamReady.current.resolved) {
          await Promise.race([
            localStreamReady.current.promise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('stream timeout')), 10_000)
            ),
          ]).catch(() =>
            console.warn('[useWebRTC] local stream not ready in 10s - answering without media')
          );
        }

        // Re-add tracks that weren't present when the PC was first created
        // (because localStreamRef was null at createPeerConnection time)
        if (localStreamRef.current) {
          const existingSenders = pc.getSenders();
          localStreamRef.current.getTracks().forEach((track) => {
            if (!existingSenders.some((s) => s.track === track)) {
              pc!.addTrack(track, localStreamRef.current!);
            }
          });
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (callIdRef.current) {
          appSocket.emit('call:signal', {
            callId: callIdRef.current,
            targetUserId: senderId,
            signal: { type: 'answer', sdp: pc.localDescription },
          });
        }
      } else if (signal.type === 'answer' && signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        // Flush buffered ICE candidates
        const buffered = iceCandidateBuffer.current.get(senderId) ?? [];
        for (const c of buffered) await pc.addIceCandidate(new RTCIceCandidate(c));
        iceCandidateBuffer.current.delete(senderId);
      } else if (signal.type === 'ice-candidate' && signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          // Buffer until remote description is available
          const buf = iceCandidateBuffer.current.get(senderId) ?? [];
          buf.push(signal.candidate);
          iceCandidateBuffer.current.set(senderId, buf);
        }
      } else if (signal.type === 'screen_share_status') {
        // Remote peer started or stopped screen sharing
        setScreenSharingUsers((prev) => ({ ...prev, [senderId]: signal.sharing ?? false }));
      }
    },
    [createPeerConnection]
  );

  /** Start sharing the screen. Replaces the video track in all peer connections. */
  const startScreenShare = useCallback(async () => {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 } },
      audio: false,
    });
    screenStreamRef.current = screenStream;
    const videoTrack = screenStream.getVideoTracks()[0];

    pcMap.current.forEach((pc, userId) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
      } else {
        // No video sender (audio-only call) — add the screen track directly
        pc.addTrack(videoTrack, screenStream);
      }
      // Notify each peer that screen sharing started
      if (callIdRef.current) {
        appSocket.emit('call:signal', {
          callId: callIdRef.current,
          targetUserId: userId,
          signal: { type: 'screen_share_status', sharing: true },
        });
      }
    });

    dispatch(setScreenSharing(true));
    // When the user clicks the browser's "Stop sharing" button
    videoTrack.onended = () => stopScreenShare();
    return screenStream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  /** Stop screen sharing and restore camera video. */
  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    dispatch(setScreenSharing(false));

    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    pcMap.current.forEach((pc, userId) => {
      if (camTrack) {
        // Restore camera track — respect the user's explicit video-off state
        camTrack.enabled = !isVideoOffRef.current;
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack);
      }
      // Notify each peer that screen sharing stopped
      if (callIdRef.current) {
        appSocket.emit('call:signal', {
          callId: callIdRef.current,
          targetUserId: userId,
          signal: { type: 'screen_share_status', sharing: false },
        });
      }
    });
  }, [dispatch]);

  /** Stop all tracks and close all peer connections. */
  const cleanup = useCallback(() => {
    pcMap.current.forEach((pc) => pc.close());
    pcMap.current.clear();
    iceCandidateBuffer.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    // Reset the stream readiness gate for the next call
    let resolve!: (s: MediaStream) => void;
    const promise = new Promise<MediaStream>((r) => {
      resolve = r;
    });
    localStreamReady.current = { promise, resolve, resolved: false };
    setLocalStream(null);
    setRemoteStreams({});
  }, []);

  // Wire socket signal handler
  useEffect(() => {
    appSocket.on('call:signal', handleSignal);
    return () => {
      appSocket.off('call:signal', handleSignal);
    };
  }, [handleSignal]);

  return {
    localStream,
    remoteStreams,
    screenSharingUsers,
    getLocalStream,
    enableVideoTrack,
    setCameraEnabled,
    initiateOffer,
    startScreenShare,
    stopScreenShare,
    cleanup,
  };
}

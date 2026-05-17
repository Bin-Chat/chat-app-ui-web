import { useRef } from 'react';
import { Mic, Send, Trash2, Square } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import VoiceMessage from './VoiceMessage';
import authorizedAxios from '@/utils/authorizedAxios';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PresignResponse {
  presignedUrl: string;
  objectKey: string;
}
interface FinalizeResponse {
  cdnUrl: string;
  size: number;
}

async function uploadAudioBlob(blob: Blob): Promise<{ url: string; size: number }> {
  const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
  const filename = `voice-${Date.now()}.${ext}`;

  const { data: presign } = await authorizedAxios.post<PresignResponse>('/api/uploads/presign', {
    filename,
    mimeType: blob.type,
    fileSize: blob.size,
    category: 'voice',
  });

  await fetch(presign.presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
  });

  const { data: finalize } = await authorizedAxios.post<FinalizeResponse>('/api/uploads/finalize', {
    objectKey: presign.objectKey,
    category: 'voice',
  });

  return { url: finalize.cdnUrl, size: finalize.size || blob.size };
}

interface VoiceRecordButtonProps {
  /** Called after upload; parent should call chatServices.sendMessage with the attachment */
  onSend: (attachment: {
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    duration: number;
    type: 'voice';
  }) => Promise<void>;
  disabled?: boolean;
}

/**
 * Microphone button for the chat input area.
 * Idle → recording (with timer + cancel/stop) → preview (play + send/cancel).
 */
export default function VoiceRecordButton({ onSend, disabled }: VoiceRecordButtonProps) {
  const { state, duration, audioBlob, audioUrl, startRecording, stopRecording, cancelRecording, clearRecording } =
    useVoiceRecorder();
  const isSendingRef = useRef(false);

  const handleSend = async () => {
    if (!audioBlob || isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
      const { url, size } = await uploadAudioBlob(audioBlob);
      await onSend({
        url,
        filename: `voice-${Date.now()}.${ext}`,
        size,
        mimeType: audioBlob.type,
        duration,
        type: 'voice',
      });
      clearRecording();
    } catch (err) {
      console.error('Failed to send voice message:', err);
    } finally {
      isSendingRef.current = false;
    }
  };

  if (state === 'idle') {
    return (
      <button
        onClick={startRecording}
        disabled={disabled}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 disabled:opacity-50"
        title="Ghi âm tin nhắn"
        aria-label="Ghi âm tin nhắn"
      >
        <Mic size={20} />
      </button>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm text-red-600 font-mono min-w-[40px]">{formatTime(duration)}</span>
        <button
          onClick={cancelRecording}
          className="p-1 rounded-full hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
          title="Huỷ ghi âm"
          aria-label="Huỷ ghi âm"
        >
          <Trash2 size={16} />
        </button>
        <button
          onClick={stopRecording}
          className="p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
          title="Dừng ghi âm"
          aria-label="Dừng ghi âm"
        >
          <Square size={16} />
        </button>
      </div>
    );
  }

  // previewing
  return (
    <div className="flex items-center gap-2 flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2">
      {audioUrl && (
        <div className="flex-1">
          <VoiceMessage url={audioUrl} duration={duration} />
        </div>
      )}
      <button
        onClick={cancelRecording}
        className="flex-shrink-0 p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
        title="Huỷ"
        aria-label="Huỷ"
      >
        <Trash2 size={18} />
      </button>
      <button
        onClick={handleSend}
        className="flex-shrink-0 p-1.5 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors"
        title="Gửi tin nhắn thoại"
        aria-label="Gửi tin nhắn thoại"
      >
        <Send size={18} />
      </button>
    </div>
  );
}

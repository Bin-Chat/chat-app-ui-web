import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import {
  Send,
  Smile,
  Paperclip,
  X,
  Image,
  FileText,
  Film,
  Reply,
  Pencil,
  Wand2,
  Mic,
  Square,
  Bot,
  Sparkles,
  AtSign,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { sendMessage, editMessage } from '@/store/slices';
import { authServices } from '@/services/authServices';
import { appSocket } from '@/services/appSocket';
import EmojiPicker from './EmojiPicker';
import RewriteMessageModal from './RewriteMessageModal';
import type { Message } from '@/types/chat.type';

// ── WAV encoder (cross-platform, no deps) ────────────────────────────────────
function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0); // mono
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  writeString(v, 0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  writeString(v, 8, 'WAVE');
  writeString(v, 12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); // 16-bit
  writeString(v, 36, 'data');
  v.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return buf;
}
async function convertToWav(blob: Blob, filename: string): Promise<File> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const wavBuffer = encodeWav(audioBuffer);
    return new File([wavBuffer], filename, { type: 'audio/wav' });
  } finally {
    ctx.close();
  }
}

interface MentionMember {
  userId: string;
  name: string;
  avatar?: string;
  isBot?: boolean;
}

interface MessageInputProps {
  conversationId: string;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  currentUserName?: string;
  members?: MentionMember[];
}

interface PendingAttachment {
  file: File;
  preview?: string; // image objectURL or video thumbnail data URL
  type: 'image' | 'video' | 'file' | 'audio';
  uploading: boolean;
  progress: number;
}

// Client-side file size limits (must match backend file-policy.ts)
const FILE_SIZE_LIMITS: Record<'image' | 'video' | 'file' | 'audio', number> = {
  image: 10 * 1024 * 1024, // 10 MB
  video: 50 * 1024 * 1024, // 50 MB
  file: 20 * 1024 * 1024, // 20 MB (backend document limit)
  audio: 10 * 1024 * 1024, // 10 MB
};

const FILE_SIZE_LABELS: Record<'image' | 'video' | 'file' | 'audio', string> = {
  image: '10 MB',
  video: '50 MB',
  file: '20 MB',
  audio: '10 MB',
};

/** Extract a human-readable message from an API error */
function extractApiError(err: unknown): string {
  if (!err) return 'Lỗi không xác định';
  // AxiosError with response data
  const resp = (err as any)?.response?.data;
  if (resp) {
    // NestJS class-validator array: { message: string[] }
    if (Array.isArray(resp.message) && resp.message.length > 0) {
      // Humanize known patterns
      const msg: string = resp.message[0];
      if (msg.includes('must not be greater than')) {
        return `File quá nặng. Giới hạn: ảnh 10 MB, video 50 MB, tài liệu 20 MB.`;
      }
      return msg;
    }
    if (typeof resp.message === 'string') return resp.message;
    if (typeof resp.error === 'string') return resp.error;
  }
  // AxiosError message
  if ((err as any)?.message) return (err as any).message;
  return String(err);
}

function getFileCategory(file: File): 'image' | 'video' | 'document' | 'voice' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'voice';
  return 'document';
}

function getAttachmentType(file: File): 'image' | 'video' | 'file' | 'audio' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

/** Extract a JPEG thumbnail data-URL from a video File using HTML5 Canvas */
function extractVideoThumbnail(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    video.onloadedmetadata = () => {
      // Seek to 10% or 1 second (whichever is shorter)
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        // Cap preview thumbnail at 320px wide to keep data-URL small
        const scale = Math.min(1, 320 / (video.videoWidth || 320));
        canvas.width = Math.round((video.videoWidth || 320) * scale);
        canvas.height = Math.round((video.videoHeight || 180) * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(undefined);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        resolve(undefined);
      } finally {
        cleanup();
      }
    };

    video.onerror = () => {
      cleanup();
      resolve(undefined);
    };
    // Timeout fallback (5 s)
    setTimeout(() => {
      cleanup();
      resolve(undefined);
    }, 5000);
  });
}

export default function MessageInput({
  conversationId,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  currentUserName = '',
  members = [],
}: MessageInputProps) {
  const dispatch = useAppDispatch();
  const sending = useAppSelector((s) => s.chat.sendingMessage);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showRewrite, setShowRewrite] = useState(false);
  const [hasBotMention, setHasBotMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const filteredMentions = mentionQuery === null ? [] : (
    mentionQuery.trim() === ''
      ? members
      : members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
  );
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  // Populate text area when switching into edit mode
  const prevEditingIdRef = useRef<string | null>(null);
  if (editingMessage && editingMessage._id !== prevEditingIdRef.current) {
    prevEditingIdRef.current = editingMessage._id;
    // use timeout to avoid setState during render
    setTimeout(() => {
      setText(editingMessage.content ?? '');
      textareaRef.current?.focus();
    }, 0);
  }
  if (!editingMessage && prevEditingIdRef.current !== null) {
    prevEditingIdRef.current = null;
  }

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      appSocket.emit('typing:stop', { conversationId });
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, [conversationId]);

  const emitTypingStart = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      appSocket.emit('typing:start', { conversationId, userName: currentUserName });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      stopTyping();
    }, 4000);
  }, [conversationId, currentUserName, stopTyping]);

  // ── Voice recording ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Use any supported format — will be converted to WAV for cross-platform compat
      const PREFERRED = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
      ];
      const mimeType = PREFERRED.find((f) => MediaRecorder.isTypeSupported(f)) ?? '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const rawBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const wavFilename = `voice_${Date.now()}.wav`;
        let audioFile: File;
        try {
          // Convert to WAV so iOS/Android can play it
          audioFile = await convertToWav(rawBlob, wavFilename);
        } catch {
          // Fallback: use raw blob if conversion fails
          audioFile = new File([rawBlob], wavFilename, { type: 'audio/wav' });
        }
        if (audioFile.size > FILE_SIZE_LIMITS.audio) {
          toast.error('Ghi âm vượt quá giới hạn 10 MB');
          return;
        }
        setAttachments((prev) => [
          ...prev,
          { file: audioFile, type: 'audio', uploading: false, progress: 0 },
        ]);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? 'Không thể truy cập microphone');
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const fmtRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const valid: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      const type = getAttachmentType(file);
      const limit = FILE_SIZE_LIMITS[type];
      if (file.size > limit) {
        toast.error(`"${file.name}" vượt quá giới hạn ${FILE_SIZE_LABELS[type]}`, {
          autoClose: 4000,
        });
        continue; // skip this file, allow others
      }

      let preview: string | undefined;
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        preview = await extractVideoThumbnail(file);
      }

      valid.push({ file, preview, type, uploading: false, progress: 0 });
    }

    if (valid.length > 0) setAttachments((prev) => [...prev, ...valid]);
    setShowFilePicker(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => {
      const att = prev[idx];
      if (att.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const uploadFile = async (
    file: File,
    onProgress: (p: number) => void,
    thumbnailDataUrl?: string
  ): Promise<{
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    thumbnailUrl?: string;
  }> => {
    const category = getFileCategory(file);

    // Sanitize filename: keep only letters, numbers, dashes, underscores, dots and spaces
    // e.g. "Report (1).pptx" → "Report_1_.pptx"
    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
    const baseName = file.name.slice(0, file.name.length - ext.length);
    const safeBase = baseName.replace(/[^\w\-. ]/g, '_').replace(/_+/g, '_');
    const safeFilename = (safeBase || 'file') + ext;

    // Step 1: presign
    const { presignedUrl, objectKey } = await authServices.presignUpload({
      category,
      filename: safeFilename,
      mimeType: file.type,
      fileSize: file.size,
    });

    // Step 2: upload to S3
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () =>
        xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // Step 3: finalize main file
    const result = await authServices.finalizeUpload({ objectKey, category });

    // Step 4: upload video thumbnail to S3 (if provided)
    let thumbnailUrl: string | undefined;
    if (thumbnailDataUrl && category === 'video') {
      try {
        // Convert data URL to Blob
        const thumbResponse = await fetch(thumbnailDataUrl);
        const thumbBlob = await thumbResponse.blob();
        const thumbFile = new File([thumbBlob], `${safeBase || 'thumb'}_thumb.jpg`, {
          type: 'image/jpeg',
        });

        const { presignedUrl: thumbPresign, objectKey: thumbKey } =
          await authServices.presignUpload({
            category: 'image',
            filename: thumbFile.name,
            mimeType: 'image/jpeg',
            fileSize: thumbFile.size,
          });

        await new Promise<void>((resolve, reject) => {
          const xhr2 = new XMLHttpRequest();
          xhr2.onload = () => (xhr2.status === 200 ? resolve() : reject());
          xhr2.onerror = () => reject();
          xhr2.open('PUT', thumbPresign);
          xhr2.setRequestHeader('Content-Type', 'image/jpeg');
          xhr2.send(thumbFile);
        });

        const thumbResult = await authServices.finalizeUpload({
          objectKey: thumbKey,
          category: 'image',
        });
        thumbnailUrl = thumbResult.cdnUrl;
      } catch {
        // Thumbnail upload failure is non-fatal — video still sends fine
      }
    }

    return {
      url: result.cdnUrl,
      filename: file.name, // keep original display name
      size: result.size,
      mimeType: result.contentType,
      thumbnailUrl,
    };
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    setMentionQuery(null);
    if (!editingMessage && !trimmed && attachments.length === 0) return;
    if (editingMessage && !trimmed) return;

    stopTyping();

    // Edit mode
    if (editingMessage) {
      try {
        await dispatch(
          editMessage({ messageId: editingMessage._id, conversationId, content: trimmed })
        ).unwrap();
        setText('');
        setHasBotMention(false);
        onCancelEdit?.();
      } catch (err: unknown) {
        toast.error(extractApiError(err));
      }
      return;
    }

    // Snapshot state before clearing UI
    const pendingAttachments = [...attachments];
    const replyTo = replyingTo
      ? {
          messageId: replyingTo._id,
          senderId: replyingTo.senderId,
          content: replyingTo.content?.slice(0, 100) || '',
          attachmentType: replyingTo.attachments?.[0]?.type,
        }
      : undefined;

    setText('');
    setHasBotMention(false);
    onCancelReply?.();

    try {
      // 1. Upload all attachments first (sequentially, with per-file progress)
      const uploadedAll: Array<{
        url: string;
        filename: string;
        size: number;
        mimeType: string;
        thumbnailUrl?: string;
        type: PendingAttachment['type'];
      }> = [];
      for (let i = 0; i < pendingAttachments.length; i++) {
        const att = pendingAttachments[i];
        setAttachments((prev) => prev.map((a, j) => (j === i ? { ...a, uploading: true } : a)));
        try {
          const uploaded = await uploadFile(
            att.file,
            (progress) => {
              setAttachments((prev) => prev.map((a, j) => (j === i ? { ...a, progress } : a)));
            },
            att.type === 'video' ? att.preview : undefined
          );
          uploadedAll.push({ ...uploaded, type: att.type });
        } catch (attErr: unknown) {
          toast.error(`Không thể upload "${att.file.name}": ${extractApiError(attErr)}`, {
            autoClose: 5000,
          });
          setAttachments((prev) =>
            prev.map((a, j) => (j === i ? { ...a, uploading: false, progress: 0 } : a))
          );
        }
      }

      // 2. Send ONE message with text + all uploaded attachments together
      if (trimmed || uploadedAll.length > 0) {
        await dispatch(
          sendMessage({
            conversationId,
            content: trimmed || undefined,
            attachments: uploadedAll.length > 0 ? uploadedAll : undefined,
            replyTo,
          })
        ).unwrap();
      }
    } catch (err: unknown) {
      toast.error(extractApiError(err));
    } finally {
      pendingAttachments.forEach((a) => {
        if (a.preview) URL.revokeObjectURL(a.preview);
      });
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setHasBotMention(/@bot\b/i.test(val));
    // Detect @query at end of text for mention autocomplete
    const m = val.match(/@([^@]*)$/);
    setMentionQuery(m ? m[1] : null);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    if (val.trim()) emitTypingStart();
    else stopTyping();
  };

  const insertMention = (member: MentionMember) => {
    const tag = member.isBot ? '@bot' : `@${member.name}`;
    const newText = text.replace(/@([^@]*)$/, `${tag} `);
    setText(newText);
    setHasBotMention(/@bot\b/i.test(newText));
    setMentionQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3 flex-shrink-0">
      {/* Edit mode banner */}
      {editingMessage && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 rounded-xl border-l-4 border-[#0068FF]">
          <Pencil className="w-3.5 h-3.5 text-[#0068FF] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-[#0068FF] truncate">
              Đang chỉnh sửa tin nhắn
            </p>
            <p className="text-[12px] text-gray-500 truncate">{editingMessage.content}</p>
          </div>
          <button
            onClick={() => {
              setText('');
              onCancelEdit?.();
              stopTyping();
            }}
            className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 flex-shrink-0"
          >
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      )}
      {/* Reply preview strip */}
      {replyingTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 rounded-xl border-l-4 border-[#0068FF]">
          <Reply className="w-3.5 h-3.5 text-[#0068FF] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-[#0068FF] truncate">Đang trả lời</p>
            <p className="text-[12px] text-gray-500 truncate">
              {replyingTo.content ||
                (replyingTo.attachments?.[0]
                  ? `[${replyingTo.attachments[0].type === 'image' ? 'Hình ảnh' : replyingTo.attachments[0].type === 'video' ? 'Video' : replyingTo.attachments[0].type === 'audio' ? 'Tin nhắn thoại' : 'Tệp tin'}]`
                  : '')}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 flex-shrink-0"
          >
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative group">
              {(att.type === 'image' || att.type === 'video') && att.preview ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 relative">
                  <img src={att.preview} alt="" className="w-full h-full object-cover" />
                  {att.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="bg-black/50 rounded-full p-1.5">
                        <Film className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ) : att.type === 'audio' ? (
                <div className="w-16 h-16 rounded-lg border border-gray-700 flex flex-col items-center justify-center bg-gray-900">
                  <Mic className="w-5 h-5 text-gray-400" />
                  <span className="text-[9px] text-gray-400 mt-1">Đã ghi âm</span>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg border border-gray-200 flex flex-col items-center justify-center bg-gray-50">
                  {att.type === 'video' ? (
                    <Film className="w-5 h-5 text-gray-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="text-[9px] text-gray-400 mt-0.5 truncate max-w-[56px] px-0.5">
                    {att.file.name.split('.').pop()}
                  </span>
                </div>
              )}
              {att.uploading && (
                <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                  <span className="text-white text-[11px] font-bold">{att.progress}%</span>
                </div>
              )}
              {!att.uploading && (
                <button
                  onClick={() => removeAttachment(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Emoji trigger */}
        <div className="relative">
          <button
            onClick={() => {
              setShowEmoji((v) => !v);
              setShowFilePicker(false);
            }}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#0068FF] transition-colors"
          >
            <Smile className="w-5 h-5" />
          </button>
          <EmojiPicker
            isOpen={showEmoji}
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmoji(false)}
          />
        </div>

        {/* File trigger */}
        <div className="relative">
          <button
            onClick={() => {
              setShowFilePicker((v) => !v);
              setShowEmoji(false);
            }}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#0068FF] transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          {showFilePicker && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowFilePicker(false)} />
              <div className="absolute bottom-full mb-2 left-0 z-40 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-[180px]">
                <button
                  onClick={() => {
                    fileInputRef.current?.setAttribute('accept', 'image/*');
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Image className="w-4 h-4 text-[#0068FF]" /> Hình ảnh
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.setAttribute('accept', 'video/*');
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Film className="w-4 h-4 text-green-500" /> Video
                </button>
                <button
                  onClick={() => {
                    fileInputRef.current?.setAttribute('accept', '*/*');
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FileText className="w-4 h-4 text-orange-500" /> Tệp tin
                </button>
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* @mention autocomplete dropdown */}
        {filteredMentions.length > 0 && !isRecording && (
          <div className="mb-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.10)] animate-in slide-in-from-bottom-2 duration-200">
            {/* Header */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
              <AtSign className="w-3 h-3 text-gray-400" />
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Nhắc đến</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredMentions.map((member) => (
                <button
                  key={member.userId}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#F0F7FF] active:bg-[#E0EFFF] transition-colors group"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {member.isBot ? (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0068FF] to-[#38BDF8] flex items-center justify-center shadow-sm">
                        <Bot className="w-[18px] h-[18px] text-white" />
                      </div>
                    ) : member.avatar ? (
                      <img src={member.avatar} className="w-9 h-9 rounded-full object-cover shadow-sm" alt={member.name} />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-sm">
                        <span className="text-[14px] font-bold text-white">{member.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    {/* Online dot placeholder */}
                    {!member.isBot && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
                    )}
                  </div>

                  {/* Name + subtitle */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-gray-800 truncate group-hover:text-[#0068FF] transition-colors">
                        {member.name}
                      </span>
                      {member.isBot && (
                        <span className="text-[9px] font-bold text-white bg-gradient-to-r from-[#0068FF] to-sky-400 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">AI</span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {member.isBot ? 'BinChat AI Assistant' : `@${member.name}`}
                    </span>
                  </div>

                  {/* Arrow hint */}
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 group-hover:bg-[#0068FF] flex items-center justify-center transition-colors">
                    <svg className="w-2.5 h-2.5 text-gray-400 group-hover:text-white transition-colors" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5h6M5.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bot mention indicator */}
        {hasBotMention && !isRecording && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl border border-[#0068FF]/20 bg-[#0068FF]/[0.04] animate-in slide-in-from-bottom-1 duration-200">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#0068FF] to-sky-400 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-semibold text-[#0068FF]">BinChat Bot</span>
              <span className="text-[11px] text-[#0068FF]/50 ml-1.5">đang ược kích hoạt</span>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-[#0068FF]/50 flex-shrink-0 animate-pulse" />
          </div>
        )}

        {/* Text area */}
        {isRecording ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-[13px] text-red-600 font-medium">
              Đang ghi âm... {fmtRecordingTime(recordingSeconds)}
            </span>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tin nhắn..."
            rows={1}
            className={`flex-1 resize-none text-[13px] py-2.5 px-3 bg-gray-50 border rounded-xl outline-none transition-colors max-h-[120px] leading-relaxed ${
              hasBotMention
                ? 'border-[#0068FF]/30 bg-[#0068FF]/[0.03] focus:border-[#0068FF]/40'
                : 'border-gray-100 focus:border-[#0068FF]/40 focus:bg-white'
            }`}
          />
        )}

        {/* Mic / Voice recording button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? 'Dừng ghi âm' : 'Ghi âm tin nhắn thoại'}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
            isRecording
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'text-gray-400 hover:bg-gray-100 hover:text-[#0068FF]'
          }`}
        >
          {isRecording ? (
            <Square className="w-4 h-4" fill="currentColor" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {/* Rewrite trigger — visible only when composing text */}
        {text.trim() && (
          <button
            onClick={() => setShowRewrite(true)}
            title="Viết lại bằng AI"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-violet-50 hover:text-violet-500 transition-colors flex-shrink-0"
          >
            <Wand2 className="w-4 h-4" />
          </button>
        )}

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={sending || (!text.trim() && attachments.length === 0)}
          className="w-9 h-9 rounded-lg bg-[#0068FF] flex items-center justify-center text-white hover:bg-[#0054CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Rewrite modal */}
      {showRewrite && (
        <RewriteMessageModal
          open={showRewrite}
          onClose={() => setShowRewrite(false)}
          messageContent={text}
          onSelectVariant={(variant) => {
            setText(variant);
            setShowRewrite(false);
            setTimeout(() => {
              const el = textareaRef.current;
              if (el) {
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                el.focus();
              }
            }, 50);
          }}
        />
      )}
    </div>
  );
}

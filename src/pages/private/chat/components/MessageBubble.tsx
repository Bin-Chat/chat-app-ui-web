import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as Dialog from '@radix-ui/react-dialog';
import {
  CornerUpRight,
  Trash2,
  RotateCcw,
  Copy,
  SmilePlus,
  Reply,
  Pencil,
  Pin,
  Phone,
  Video,
  PhoneMissed,
  VideoOff,
  Languages,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

import { useAppDispatch, useAppSelector } from '@/hooks/useRedux';
import { revokeMessage, deleteMessage, reactToMessage } from '@/store/slices';
import UserAvatar from '@/components/UserAvatar';
import type { Message } from '@/types/chat.type';
import ImageGrid from './ImageGrid';
import TranslateMessageModal from './TranslateMessageModal';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

// Tooltip wrapper — uses the TooltipProvider mounted at App root
function ActionBtn({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <button onClick={onClick} className={className}>
          {children}
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          className="bg-gray-800 text-white text-[11px] px-2 py-1 rounded-md shadow-md select-none z-[100]"
          sideOffset={5}
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-gray-800" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  senderName?: string | null;
  senderAvatar?: string | null;
  conversationId: string;
  onForward: () => void;
  onReply: (message: Message) => void;
  onScrollToMessage: (messageId: string) => void;
  isHighlighted?: boolean;
  /** Controlled externally by ChatRoom — only one bubble shows actions at a time */
  isHovered?: boolean;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  bubbleRef?: (el: HTMLDivElement | null) => void;
  onEdit?: () => void;
  onPin?: () => void;
  isAdminOrOwner?: boolean;
  conversationType?: 'direct' | 'group';
  onlyAdminCanPin?: boolean;
}

export default function MessageBubble({
  message,
  isMine,
  showAvatar,
  senderName,
  senderAvatar,
  conversationId,
  onForward,
  onReply,
  onScrollToMessage,
  isHighlighted,
  isHovered = false,
  onHoverIn,
  onHoverOut,
  bubbleRef,
  onEdit,
  onPin,
  isAdminOrOwner = false,
  conversationType,
  onlyAdminCanPin = false,
}: MessageBubbleProps) {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((s) => s.auth.user);
  const [showReactions, setShowReactions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const showActions = isHovered;

  const isRevoked = !!message.revokedAt;
  const isSystemMsg = message.type === 'system' || message.senderId === 'system';
  const timeStr = format(new Date(message.createdAt), 'HH:mm');

  const canRevoke =
    isMine &&
    !isRevoked &&
    !isSystemMsg &&
    (() => {
      const diff = Date.now() - new Date(message.createdAt).getTime();
      return diff < 24 * 60 * 60 * 1000; // 24 hours
    })();

  const canEdit =
    isMine &&
    !isRevoked &&
    !isSystemMsg &&
    (() => {
      const diff = Date.now() - new Date(message.createdAt).getTime();
      return diff < 30 * 60 * 1000; // 30 minutes
    })();

  // Direct chat: any participant can pin; Group chat: respect onlyAdminCanPin setting
  const canPin = !isRevoked && !isSystemMsg && (!onlyAdminCanPin || isAdminOrOwner);

  const images = message.attachments.filter((a) => a.type === 'image');
  const videos = message.attachments.filter((a) => a.type === 'video');
  const files = message.attachments.filter((a) => a.type === 'file');
  const audios = message.attachments.filter((a) => a.type === 'audio');
  const attachmentsOnly =
    (images.length > 0 || videos.length > 0 || files.length > 0 || audios.length > 0) &&
    !message.content;
  // Pure image message (no text, no files, no video) — display without bubble background
  const imageOnly =
    images.length > 0 &&
    files.length === 0 &&
    videos.length === 0 &&
    audios.length === 0 &&
    !message.content;
  // Pure video message — no bubble background
  const videoOnly =
    videos.length > 0 &&
    images.length === 0 &&
    files.length === 0 &&
    audios.length === 0 &&
    !message.content;
  // Pure file message — minimal card style, no coloured background
  const fileOnly =
    files.length > 0 &&
    images.length === 0 &&
    videos.length === 0 &&
    audios.length === 0 &&
    !message.content;
  // Pure audio message — waveform card, no coloured background
  const audioOnly =
    audios.length > 0 &&
    images.length === 0 &&
    videos.length === 0 &&
    files.length === 0 &&
    !message.content;

  const handleRevoke = async () => {
    try {
      await dispatch(revokeMessage({ messageId: message._id, conversationId })).unwrap();
      toast.success('Đã thu hồi tin nhắn');
    } catch (err: any) {
      toast.error(err ?? 'Không thể thu hồi');
    }
    onHoverOut?.();
  };

  // Opens confirmation dialog instead of immediately deleting
  const handleDeleteConfirmed = async () => {
    try {
      await dispatch(deleteMessage({ messageId: message._id, conversationId })).unwrap();
    } catch (err: any) {
      toast.error(err ?? 'Không thể xóa');
    }
    setConfirmDelete(false);
    onHoverOut?.();
  };

  const handleReact = (emoji: string) => {
    if (!currentUser) return;
    dispatch(
      reactToMessage({ messageId: message._id, conversationId, emoji, userId: currentUser.id })
    );
    setShowReactions(false);
  };

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast.success('Đã sao chép');
    }
    onHoverOut?.();
  };

  // Group reactions by emoji
  const groupedReactions = (message.reactions ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  // ── Shared delete confirmation dialog ──
  const deleteDialog = (
    <Dialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-5 w-[300px] shadow-xl z-50 focus:outline-none">
          <Dialog.Title className="text-[15px] font-semibold text-gray-800 mb-1.5">
            {isMine ? 'Xóa ở phía tôi' : 'Xóa tin nhắn'}
          </Dialog.Title>
          <Dialog.Description className="text-[13px] text-gray-500 mb-5 leading-relaxed">
            {isMine
              ? 'Tin nhắn sẽ biến mất khỏi màn hình của bạn. Người nhận vẫn thấy tin nhắn này bình thường.'
              : 'Tin nhắn sẽ biến mất hoàn toàn khỏi màn hình của bạn như chưa từng tồn tại.'}
          </Dialog.Description>
          <div className="flex gap-2 justify-end">
            <Dialog.Close asChild>
              <button className="px-4 py-1.5 rounded-lg text-[13px] text-gray-600 hover:bg-gray-100 transition-colors">
                Hủy
              </button>
            </Dialog.Close>
            <button
              onClick={handleDeleteConfirmed}
              className="px-4 py-1.5 rounded-lg text-[13px] bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Xóa
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  // System messages (call events, group events) render as centered non-interactive pills
  if (isSystemMsg) {
    const content = message.content ?? '';

    // ── Call system messages ─────────────────────────────────────────
    // New format: '[VOICE] ...' / '[VIDEO] ...' — legacy: '📞 ...' / '📹 ...'
    const isVoiceCall = content.startsWith('[VOICE]') || content.startsWith('📞');
    const isVideoCall = content.startsWith('[VIDEO]') || content.startsWith('📹');

    if (isVoiceCall || isVideoCall) {
      // Strip prefix to get human-readable text
      const rest =
        content.startsWith('[VOICE]') || content.startsWith('[VIDEO]')
          ? content.slice(7).trim()
          : content.slice(2).trim(); // legacy emoji

      const isMissed = rest.includes('bị hủy');

      // Parse "Cuộc gọi thoại - 01:23" → callLabel & duration
      const dashIdx = rest.lastIndexOf(' - ');
      const callLabel = dashIdx !== -1 ? rest.slice(0, dashIdx) : rest;
      const duration = dashIdx !== -1 ? rest.slice(dashIdx + 3) : null;

      const CallIcon = isVideoCall ? (isMissed ? VideoOff : Video) : isMissed ? PhoneMissed : Phone;

      const iconBg = isMissed
        ? 'bg-gray-100 dark:bg-gray-700'
        : isVideoCall
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'bg-green-50 dark:bg-green-900/20';

      const iconColor = isMissed
        ? 'text-gray-400 dark:text-gray-500'
        : isVideoCall
          ? 'text-blue-500'
          : 'text-green-500';

      return (
        <div className="flex justify-center my-3">
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 max-w-[280px] shadow-sm">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}
            >
              <CallIcon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 leading-tight truncate">
                {callLabel}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {isMissed ? 'Không thành công' : (duration ?? 'Đã kết thúc')}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // ── Generic system pill (group events, etc.) ─────────────────────
    return (
      <div className="flex justify-center my-1.5">
        <span className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full select-none">
          {content}
        </span>
      </div>
    );
  }

  if (isRevoked) {
    return (
      <div
        ref={bubbleRef}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} group relative ${!showAvatar && !isMine ? 'pl-11' : ''}`}
        onMouseEnter={onHoverIn}
        onMouseLeave={onHoverOut}
      >
        {showAvatar && !isMine && (
          <div className="mr-2 mt-auto mb-1">
            <UserAvatar src={senderAvatar} name={senderName} size={28} />
          </div>
        )}
        <div className="relative">
          {message.revokedBy === 'ai-moderation' ? (
            <div className="px-3 py-2.5 rounded-2xl border border-red-200 bg-red-50 max-w-[400px]">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-red-600">
                    Vi phạm chính sách cộng đồng
                  </p>
                  <p className="text-[11px] text-red-400 mt-0.5">
                    Tin nhắn này đã bị hệ thống AI kiểm duyệt và xóa tự động do nội dung không phù
                    hợp.
                  </p>
                </div>
              </div>
              <span className="block text-right text-[10px] text-red-300 mt-1">{timeStr}</span>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-2xl bg-gray-100 text-[13px] text-gray-400 italic max-w-[420px]">
              Tin nhắn đã được thu hồi
              <span className="ml-2 text-[11px] text-gray-300">{timeStr}</span>
            </div>
          )}
          {/* Allow the user to also remove this revoked placeholder from their view */}
          <AnimatePresence>
            {showActions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.1 }}
                className={`absolute top-0 z-10 flex items-center gap-0.5 bg-white rounded-lg shadow-md border border-gray-100 p-0.5 ${
                  isMine ? 'right-full mr-1' : 'left-full ml-1'
                }`}
              >
                <ActionBtn
                  label={isMine ? 'Xóa ở phía tôi' : 'Xóa'}
                  onClick={() => setConfirmDelete(true)}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </ActionBtn>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {deleteDialog}
      </div>
    );
  }

  return (
    <div
      ref={bubbleRef}
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} group relative ${!showAvatar && !isMine ? 'pl-11' : ''} transition-all duration-300 ${isHighlighted ? 'ring-2 ring-[#0068FF]/50 rounded-2xl bg-[#0068FF]/5' : ''}`}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
    >
      {showAvatar && !isMine && (
        <div className="mr-2 mt-auto mb-1 flex-shrink-0">
          <UserAvatar src={senderAvatar} name={senderName} size={28} />
        </div>
      )}

      <div className={`relative max-w-[420px] ${isMine ? 'order-1' : ''}`}>
        {message.forwardedFrom && (
          <p className="text-[11px] text-gray-400 mb-0.5 flex items-center gap-1">
            <CornerUpRight className="w-3 h-3" /> Đã chuyển tiếp
          </p>
        )}

        {/* Bubble */}
        <div
          className={`rounded-2xl ${
            imageOnly
              ? // Pure image — no background, images fill the rounded container
                'overflow-hidden'
              : videoOnly || fileOnly || audioOnly
                ? // Pure video / pure file / pure audio — transparent, no coloured background
                  'overflow-hidden'
                : attachmentsOnly
                  ? isMine
                    ? 'bg-[#0068FF] overflow-hidden'
                    : 'bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-gray-100'
                  : isMine
                    ? 'bg-[#0068FF] text-white px-3 py-2'
                    : 'bg-white text-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.06)] px-3 py-2'
          }`}
        >
          {/* Reply quoted band */}
          {message.replyTo && (
            <div className={attachmentsOnly ? 'px-3 pt-2' : ''}>
              <button
                onClick={() => onScrollToMessage(message.replyTo!.messageId)}
                className={`w-full text-left mb-2 px-2 py-1.5 rounded-lg border-l-[3px] ${
                  isMine
                    ? 'bg-white/20 border-white/60 hover:bg-white/30'
                    : 'bg-gray-50 border-[#0068FF]/50 hover:bg-gray-100'
                } transition-colors`}
              >
                <p
                  className={`text-[11px] font-semibold truncate ${
                    isMine ? 'text-white/80' : 'text-[#0068FF]'
                  }`}
                >
                  {message.replyTo.senderId === message.senderId
                    ? 'Chính mình'
                    : (senderName ?? 'Người dùng')}
                </p>
                <p className={`text-[12px] truncate ${isMine ? 'text-white/60' : 'text-gray-500'}`}>
                  {message.replyTo.content ||
                    `[${message.replyTo.attachmentType === 'image' ? 'Hình ảnh' : message.replyTo.attachmentType === 'video' ? 'Video' : message.replyTo.attachmentType === 'audio' ? 'Tin nhắn thoại' : 'Tệp tin'}]`}
                </p>
              </button>
            </div>
          )}

          {/* Images */}
          {images.length > 0 &&
            (imageOnly ? (
              // Pure image message: no border wrapper, no background — images only
              <ImageGrid images={images} />
            ) : (
              // Mixed content (image + text or image + file): subtle border wrapper
              <div className="overflow-hidden mb-1.5">
                <ImageGrid images={images} />
              </div>
            ))}

          {/* Videos — poster from uploaded thumbnail; src falls back through Lambda variants to original */}
          {videos.map((v) => {
            // Derive Lambda variant URLs from the base CDN URL
            const dotIdx = v.url.lastIndexOf('.');
            const baseUrl = dotIdx !== -1 ? v.url.slice(0, dotIdx) : v.url;
            // Use uploaded thumbnail first; Lambda __thumb.jpg as secondary
            const posterUrl = v.thumbnailUrl ?? `${baseUrl}__thumb.jpg`;
            return (
              <div key={v.url} className="mb-1.5 overflow-hidden rounded-xl">
                <video
                  controls
                  preload="metadata"
                  poster={posterUrl}
                  className="max-w-full max-h-[320px] w-full rounded-xl block"
                  onError={(e) => {
                    // If a source fails, the browser auto-tries the next <source>
                    // This handler silences console errors for missing Lambda variants
                    e.currentTarget.style.display = '';
                  }}
                >
                  {/* Lambda 360p (available after async processing) */}
                  <source src={`${baseUrl}__360p.mp4`} type="video/mp4" />
                  {/* Original always as final fallback */}
                  <source src={v.url} type="video/mp4" />
                </video>
              </div>
            );
          })}

          {/* Files */}
          {files.map((f) => (
            <a
              key={f.url}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 py-2.5 px-3 rounded-xl mb-1 last:mb-0 ${
                fileOnly
                  ? 'bg-gray-50 hover:bg-gray-100 border border-gray-100'
                  : isMine
                    ? 'bg-white/15 hover:bg-white/25 border border-white/20'
                    : 'bg-gray-50 hover:bg-gray-100 border border-gray-100'
              } transition-colors`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  fileOnly ? 'bg-[#0068FF]/10' : isMine ? 'bg-white/20' : 'bg-[#0068FF]/10'
                }`}
              >
                <span
                  className={`text-[10px] font-bold ${fileOnly ? 'text-[#0068FF]' : isMine ? 'text-white' : 'text-[#0068FF]'}`}
                >
                  {f.filename.split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[13px] font-medium truncate ${fileOnly ? 'text-gray-800' : isMine ? 'text-white' : 'text-gray-800'}`}
                >
                  {f.filename}
                </p>
                {f.size && (
                  <p
                    className={`text-[11px] mt-0.5 ${fileOnly ? 'text-gray-400' : isMine ? 'text-white/60' : 'text-gray-400'}`}
                  >
                    {f.size >= 1024 * 1024
                      ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
                      : `${(f.size / 1024).toFixed(0)} KB`}
                  </p>
                )}
              </div>
            </a>
          ))}

          {/* Text content */}
          {message.content && (
            <p
              className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words ${attachmentsOnly ? 'px-3 pb-1' : ''}`}
            >
              {message.content}
              {message.isEdited && (
                <span className="text-[10px] italic opacity-50 ml-1">(đã chỉnh sửa)</span>
              )}
            </p>
          )}

          {/* Audio attachments */}
          {audios.map((a) => (
            <div
              key={a.url}
              className={`flex items-center gap-3 py-2 px-3 rounded-xl my-0.5 ${
                audioOnly
                  ? isMine
                    ? 'bg-[#0068FF]/10'
                    : 'bg-gray-50 border border-gray-100'
                  : isMine
                    ? 'bg-white/15 border border-white/20'
                    : 'bg-gray-50 border border-gray-100'
              }`}
            >
              <audio
                controls
                preload="metadata"
                src={a.url}
                className="h-9 max-w-[240px]"
                style={{ accentColor: '#0068FF' }}
              />
            </div>
          ))}

          {/* Time */}
          <p
            className={`text-[11px] mt-1 ${
              imageOnly
                ? 'absolute bottom-1.5 right-2 text-white drop-shadow-sm bg-black/30 px-1.5 py-0.5 rounded-full'
                : videoOnly || fileOnly
                  ? 'text-gray-400 text-right px-1'
                  : isMine
                    ? 'text-white/60'
                    : 'text-gray-400'
            } text-right ${attachmentsOnly && !imageOnly && !videoOnly && !fileOnly ? 'px-3 pb-2' : ''}`}
          >
            {timeStr}
          </p>
        </div>

        {/* Reactions display */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(groupedReactions).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white shadow-sm border border-gray-100 text-[12px] hover:bg-gray-50 transition-colors"
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-gray-500 text-[11px]">{count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              ref={actionsRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.1 }}
              onMouseEnter={onHoverIn}
              onMouseLeave={onHoverOut}
              className={`absolute top-0 z-10 flex items-center gap-0.5 bg-white rounded-lg shadow-md border border-gray-100 p-0.5 ${
                isMine ? 'right-full mr-1' : 'left-full ml-1'
              }`}
            >
              <ActionBtn
                label="Cảm xúc"
                onClick={() => setShowReactions((v) => !v)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <SmilePlus className="w-3.5 h-3.5" />
              </ActionBtn>
              <ActionBtn
                label="Trả lời"
                onClick={() => {
                  onReply(message);
                  onHoverOut?.();
                }}
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-[#0068FF] transition-colors"
              >
                <Reply className="w-3.5 h-3.5" />
              </ActionBtn>
              <ActionBtn
                label="Chuyển tiếp"
                onClick={() => {
                  onForward();
                  onHoverOut?.();
                }}
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <CornerUpRight className="w-3.5 h-3.5" />
              </ActionBtn>
              {message.content && (
                <ActionBtn
                  label="Sao chép"
                  onClick={handleCopy}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </ActionBtn>
              )}
              {message.content && !message.revokedAt && (
                <ActionBtn
                  label="Dịch tin nhắn"
                  onClick={() => {
                    setShowTranslate(true);
                    onHoverOut?.();
                  }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-purple-50 hover:text-purple-500 transition-colors"
                >
                  <Languages className="w-3.5 h-3.5" />
                </ActionBtn>
              )}

              {canEdit && onEdit && (
                <ActionBtn
                  label="Chỉnh sửa"
                  onClick={() => {
                    onEdit();
                    onHoverOut?.();
                  }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </ActionBtn>
              )}
              {canPin && onPin && (
                <ActionBtn
                  label="Đưa lên/bỏ ghim"
                  onClick={() => {
                    onPin();
                    onHoverOut?.();
                  }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-amber-50 hover:text-amber-500 transition-colors"
                >
                  <Pin className="w-3.5 h-3.5" />
                </ActionBtn>
              )}
              {isMine && canRevoke && (
                <ActionBtn
                  label="Thu hồi"
                  onClick={handleRevoke}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-orange-50 hover:text-orange-500 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </ActionBtn>
              )}
              <ActionBtn
                label={isMine ? 'Xóa ở phía tôi' : 'Xóa'}
                onClick={() => setConfirmDelete(true)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </ActionBtn>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reaction picker — independent of action-button hover so mouse can travel freely */}
        <AnimatePresence>
          {showReactions && (
            <>
              <div className="fixed inset-0 z-[19]" onClick={() => setShowReactions(false)} />
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.12 }}
                onMouseEnter={onHoverIn}
                className={`absolute z-20 flex items-center gap-1 bg-white rounded-xl shadow-lg border border-gray-100 px-2 py-1.5 ${
                  isMine ? 'right-0 bottom-full mb-1' : 'left-0 bottom-full mb-1'
                }`}
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="text-[18px] hover:scale-125 transition-transform px-0.5"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      {deleteDialog}
      {showTranslate && message.content && (
        <TranslateMessageModal
          open={showTranslate}
          onClose={() => setShowTranslate(false)}
          messageContent={message.content}
        />
      )}
    </div>
  );
}

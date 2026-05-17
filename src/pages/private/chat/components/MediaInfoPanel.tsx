import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Image, FileText, Link, Download } from 'lucide-react';
import { chatServices } from '@/services/chatServices';

interface MediaItem {
  messageId: string;
  senderId: string;
  createdAt: string;
  url: string;
  type?: string;
  thumbnailUrl?: string | null;
  filename?: string;
  size?: number;
}

interface FileItem {
  messageId: string;
  senderId: string;
  createdAt: string;
  url: string;
  filename: string;
  size?: number;
  mimeType?: string;
}

interface LinkItem {
  messageId: string;
  senderId: string;
  createdAt: string;
  url: string;
  domain: string;
}

interface MediaInfoPanelProps {
  conversationId: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Media section ──────────────────────────────────────────────────────────

function MediaSection({ conversationId }: { conversationId: string }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const loadMore = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const res = await chatServices.getConversationMedia(conversationId, 'image', cursor);
        setItems((prev) =>
          cursor ? [...prev, ...(res.items as MediaItem[])] : (res.items as MediaItem[])
        );
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  const displayed = showAll ? items : items.slice(0, 9);

  return (
    <div>
      {loading && items.length === 0 ? (
        <div className="text-[12px] text-gray-400 text-center py-4">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="text-[12px] text-gray-400 text-center py-4">Chưa có ảnh/video nào</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1">
            {displayed.map((item, i) => (
              <a
                key={`${item.messageId}-${i}`}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-md overflow-hidden bg-gray-100 block"
              >
                {item.type === 'video' ? (
                  <div className="w-full h-full relative">
                    <img
                      src={item.thumbnailUrl ?? item.url}
                      alt="video"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <span className="text-white text-xl">▶</span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={item.url}
                    alt={item.filename ?? 'ảnh'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </a>
            ))}
          </div>

          {!showAll && items.length > 9 && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-2 w-full text-[12px] text-[#0068FF] hover:underline text-center"
            >
              Xem tất cả ({items.length}
              {hasMore ? '+' : ''})
            </button>
          )}

          {showAll && hasMore && (
            <button
              onClick={() => loadMore(nextCursor ?? undefined)}
              disabled={loading}
              className="mt-2 w-full text-[12px] text-[#0068FF] hover:underline text-center disabled:opacity-50"
            >
              {loading ? 'Đang tải...' : 'Tải thêm'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── File section ───────────────────────────────────────────────────────────

function FileSection({ conversationId }: { conversationId: string }) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMore = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const res = await chatServices.getConversationMedia(conversationId, 'file', cursor);
        setItems((prev) =>
          cursor ? [...prev, ...(res.items as FileItem[])] : (res.items as FileItem[])
        );
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  return (
    <div className="space-y-1">
      {loading && items.length === 0 ? (
        <div className="text-[12px] text-gray-400 text-center py-4">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="text-[12px] text-gray-400 text-center py-4">Chưa có file nào</div>
      ) : (
        <>
          {items.map((item, i) => (
            <div
              key={`${item.messageId}-${i}`}
              className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#0068FF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-gray-800 truncate">{item.filename}</p>
                <p className="text-[11px] text-gray-400">
                  {formatBytes(item.size)} · {formatDate(item.createdAt)}
                </p>
              </div>
              <a
                href={item.url}
                download={item.filename}
                target="_blank"
                rel="noopener noreferrer"
                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Tải xuống"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={() => loadMore(nextCursor ?? undefined)}
              disabled={loading}
              className="w-full text-[12px] text-[#0068FF] hover:underline text-center disabled:opacity-50 mt-1"
            >
              {loading ? 'Đang tải...' : 'Tải thêm'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Link section ───────────────────────────────────────────────────────────

function LinkSection({ conversationId }: { conversationId: string }) {
  const [items, setItems] = useState<LinkItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMore = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const res = await chatServices.getConversationMedia(conversationId, 'link', cursor);
        setItems((prev) =>
          cursor ? [...prev, ...(res.items as LinkItem[])] : (res.items as LinkItem[])
        );
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  useEffect(() => {
    loadMore();
  }, [loadMore]);

  return (
    <div className="space-y-1">
      {loading && items.length === 0 ? (
        <div className="text-[12px] text-gray-400 text-center py-4">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="text-[12px] text-gray-400 text-center py-4">Chưa có link nào</div>
      ) : (
        <>
          {items.map((item, i) => (
            <a
              key={`${item.messageId}-${i}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 group"
            >
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Link className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#0068FF] group-hover:underline truncate">
                  {item.domain}
                </p>
                <p className="text-[11px] text-gray-400 truncate">{item.url}</p>
                <p className="text-[10px] text-gray-300">{formatDate(item.createdAt)}</p>
              </div>
            </a>
          ))}

          {hasMore && (
            <button
              onClick={() => loadMore(nextCursor ?? undefined)}
              disabled={loading}
              className="w-full text-[12px] text-[#0068FF] hover:underline text-center disabled:opacity-50 mt-1"
            >
              {loading ? 'Đang tải...' : 'Tải thêm'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Collapsible section wrapper ────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 group"
      >
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

export default function MediaInfoPanel({ conversationId }: MediaInfoPanelProps) {
  return (
    <div>
      <CollapsibleSection title="Ảnh/Video" icon={<Image className="w-4 h-4" />} defaultOpen={true}>
        <MediaSection conversationId={conversationId} />
      </CollapsibleSection>

      <CollapsibleSection title="File" icon={<FileText className="w-4 h-4" />}>
        <FileSection conversationId={conversationId} />
      </CollapsibleSection>

      <CollapsibleSection title="Link" icon={<Link className="w-4 h-4" />}>
        <LinkSection conversationId={conversationId} />
      </CollapsibleSection>
    </div>
  );
}

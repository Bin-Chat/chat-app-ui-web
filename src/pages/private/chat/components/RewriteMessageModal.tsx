import { useState } from 'react';
import { Wand2, Loader2, X, Check, Copy, ArrowUpRight } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { aiServices, RewriteVariant } from '@/services/aiServices';
import { toast } from 'react-toastify';

interface RewriteMessageModalProps {
  open: boolean;
  onClose: () => void;
  messageContent: string;
  /** Called when user clicks "Dùng" on a variant. If provided, shows Use button on each variant. */
  onSelectVariant?: (text: string) => void;
}

export default function RewriteMessageModal({
  open,
  onClose,
  messageContent,
  onSelectVariant,
}: RewriteMessageModalProps) {
  const [rewrites, setRewrites] = useState<RewriteVariant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleRewrite = async () => {
    setLoading(true);
    setRewrites(null);
    try {
      const res = await aiServices.rewrite(messageContent);
      setRewrites(res.rewrites);
    } catch {
      toast.error('Viết lại thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      setRewrites(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl w-[480px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl z-50 focus:outline-none">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-violet-500" />
            </div>
            <Dialog.Title className="flex-1 text-[14px] font-semibold text-gray-800">
              Viết lại tin nhắn
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Original */}
            <div>
              <p className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Nội dung gốc</p>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-[13px] text-gray-700 leading-relaxed max-h-[80px] overflow-y-auto">
                {messageContent}
              </div>
            </div>

            {/* Results */}
            {loading && (
              <div className="flex items-center gap-2 bg-violet-50 rounded-xl px-3 py-5 justify-center">
                <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                <span className="text-[13px] text-gray-400">AI đang viết lại...</span>
              </div>
            )}

            {rewrites && !loading && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Các phiên bản viết lại</p>
                {rewrites.map((r, idx) => (
                  <div key={r.style} className="group relative bg-gray-50 hover:bg-violet-50/50 rounded-xl px-3 py-3 transition-colors border border-transparent hover:border-violet-100">
                    <p className="text-[11px] font-semibold text-violet-600 mb-1">{r.label}</p>
                    <p className="text-[13px] text-gray-800 leading-relaxed pr-8">{r.text}</p>
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      {onSelectVariant && (
                        <button
                          onClick={() => onSelectVariant(r.text)}
                          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-violet-200 text-violet-600 transition-all"
                          title="Dùng đoạn này"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(r.text, idx)}
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-violet-100 text-gray-400 hover:text-violet-600 transition-all"
                        title="Sao chép"
                      >
                        {copiedIdx === idx ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 pb-4 pt-2 flex-shrink-0 border-t border-gray-100">
            <Dialog.Close asChild>
              <button className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors">
                Đóng
              </button>
            </Dialog.Close>
            <button
              onClick={handleRewrite}
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-violet-500 text-white text-[13px] font-medium hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xử lý...</>
              ) : (
                <><Wand2 className="w-3.5 h-3.5" /> {rewrites ? 'Viết lại tiếp' : 'Viết lại ngay'}</>
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

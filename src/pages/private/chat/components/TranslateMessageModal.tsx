import { useState } from 'react';
import { Languages, Loader2, X, Check } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { aiServices } from '@/services/aiServices';
import { toast } from 'react-toastify';

const LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];

interface TranslateMessageModalProps {
  open: boolean;
  onClose: () => void;
  messageContent: string;
}

export default function TranslateMessageModal({
  open,
  onClose,
  messageContent,
}: TranslateMessageModalProps) {
  const [targetLang, setTargetLang] = useState('en');
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTranslate = async () => {
    setLoading(true);
    setTranslated(null);
    try {
      const res = await aiServices.translate(messageContent, targetLang);
      setTranslated(res.translated);
    } catch {
      toast.error('Dịch thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!translated) return;
    navigator.clipboard.writeText(translated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      onClose();
      setTranslated(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl w-[440px] max-w-[95vw] shadow-2xl z-50 focus:outline-none">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <Languages className="w-4 h-4 text-[#0068FF]" />
            </div>
            <Dialog.Title className="flex-1 text-[14px] font-semibold text-gray-800">
              Dịch tin nhắn
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Original */}
            <div>
              <p className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Nội dung gốc</p>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-[13px] text-gray-700 leading-relaxed max-h-[100px] overflow-y-auto">
                {messageContent}
              </div>
            </div>

            {/* Language selector */}
            <div>
              <p className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Dịch sang</p>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { setTargetLang(lang.code); setTranslated(null); }}
                    className={`px-3 py-1 rounded-full text-[12px] transition-colors ${
                      targetLang === lang.code
                        ? 'bg-[#0068FF] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Translation result */}
            {(loading || translated) && (
              <div>
                <p className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Kết quả dịch</p>
                {loading ? (
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-4 justify-center">
                    <Loader2 className="w-5 h-5 text-[#0068FF] animate-spin" />
                    <span className="text-[13px] text-gray-400">Đang dịch...</span>
                  </div>
                ) : (
                  <div className="relative bg-blue-50 rounded-xl px-3 py-2.5">
                    <p className="text-[13px] text-gray-800 leading-relaxed pr-7">{translated}</p>
                    <button
                      onClick={handleCopy}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md hover:bg-blue-100 text-gray-400"
                      title="Sao chép"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 pb-4">
            <Dialog.Close asChild>
              <button className="flex-1 py-2 rounded-xl border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50 transition-colors">
                Đóng
              </button>
            </Dialog.Close>
            <button
              onClick={handleTranslate}
              disabled={loading}
              className="flex-1 py-2 rounded-xl bg-[#0068FF] text-white text-[13px] font-medium hover:bg-[#005CE6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang dịch...</> : translated ? 'Dịch lại' : 'Dịch ngay'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { useState } from 'react';
import { X } from 'lucide-react';
import { getVariantUrl } from '@/utils/imageUrl';

interface ChatImageProps {
  src: string;
  alt?: string;
  className?: string;
}

/**
 * Ảnh trong chat:
 * - Hiển thị variant __medium (max 512px) inline
 * - Click → lightbox dùng __large (max 1080px)
 * - Fallback về ảnh gốc nếu variant lỗi
 */
export default function ChatImage({ src, alt = 'image', className }: ChatImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [inlineFailed, setInlineFailed] = useState(false);
  const [lightboxFailed, setLightboxFailed] = useState(false);

  const mediumSrc = getVariantUrl(src, 'medium') ?? src;
  const largeSrc = getVariantUrl(src, 'large') ?? src;

  return (
    <>
      <img
        src={inlineFailed ? src : mediumSrc}
        alt={alt}
        className={`cursor-pointer rounded-lg max-w-[280px] max-h-[280px] object-cover ${className ?? ''}`}
        onClick={() => setLightboxOpen(true)}
        onError={() => setInlineFailed(true)}
      />

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={28} />
          </button>
          <img
            src={lightboxFailed ? src : largeSrc}
            alt={alt}
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
            onError={() => setLightboxFailed(true)}
          />
        </div>
      )}
    </>
  );
}

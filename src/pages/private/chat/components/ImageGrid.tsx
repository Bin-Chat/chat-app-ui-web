import { useState } from 'react';
import type { Attachment } from '@/types/chat.type';

interface ImageGridProps {
  images: Attachment[];
}

export default function ImageGrid({ images }: ImageGridProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (images.length === 0) return null;

  const openLightbox = (idx: number) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);

  const renderImage = (img: Attachment, idx: number, className: string) => (
    <button
      key={img.url}
      onClick={() => openLightbox(idx)}
      className={`!overflow-hidden rounded-xl ${className}`}
    >
      <img
        src={img.thumbnailUrl || img.url}
        alt={img.filename}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </button>
  );

  let gridContent: React.ReactNode;

  if (images.length === 1) {
    // Single image: natural width, height auto, cap at 320px, no forced aspect ratio
    gridContent = (
      <button onClick={() => openLightbox(0)} className="overflow-hidden rounded-xl block">
        <img
          src={images[0].thumbnailUrl || images[0].url}
          alt={images[0].filename}
          className="max-w-[300px] max-h-[320px] w-auto h-auto object-contain rounded-xl"
          loading="lazy"
        />
      </button>
    );
  } else if (images.length === 2) {
    gridContent = (
      <div className="grid grid-cols-2 gap-[2px] max-w-[300px] rounded-xl overflow-hidden">
        {images.map((img, i) => renderImage(img, i, 'aspect-square'))}
      </div>
    );
  } else if (images.length === 3) {
    gridContent = (
      <div className="grid grid-cols-2 gap-[2px] max-w-[300px] rounded-xl overflow-hidden">
        <div className="col-span-2">
          {renderImage(images[0], 0, 'aspect-video w-full rounded-none')}
        </div>
        {images.slice(1).map((img, i) => renderImage(img, i + 1, 'aspect-square rounded-none'))}
      </div>
    );
  } else {
    // 4+ images: 2x2 grid with overlay for extras
    const displayed = images.slice(0, 4);
    const remaining = images.length - 4;

    gridContent = (
      <div className="grid grid-cols-2 gap-[2px] max-w-[300px] rounded-xl !overflow-hidden">
        {displayed.map((img, i) => (
          <div key={img.url} className="relative">
            {renderImage(img, i, 'aspect-square w-full rounded-none')}
            {i === 3 && remaining > 0 && (
              <button
                onClick={() => openLightbox(3)}
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="text-white text-lg font-bold">+{remaining}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-1.5">
      {gridContent}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[lightboxIdx].url}
              alt={images[lightboxIdx].filename}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            {/* Navigation */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-4 py-2">
                <button
                  onClick={() => setLightboxIdx((lightboxIdx - 1 + images.length) % images.length)}
                  className="text-white hover:text-white/80 text-sm px-2"
                >
                  ←
                </button>
                <span className="text-white text-sm">
                  {lightboxIdx + 1} / {images.length}
                </span>
                <button
                  onClick={() => setLightboxIdx((lightboxIdx + 1) % images.length)}
                  className="text-white hover:text-white/80 text-sm px-2"
                >
                  →
                </button>
              </div>
            )}
            <button
              onClick={closeLightbox}
              className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

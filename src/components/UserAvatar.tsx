import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getVariantUrl, type ImageVariant } from '@/utils/imageUrl';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  variant?: ImageVariant;
  className?: string;
  online?: boolean;
}

/**
 * Avatar thông minh:
 * - Tự dùng variant __thumb / __medium / __large từ Lambda image-processor
 * - Fallback về ảnh gốc nếu variant lỗi (404 / chưa xử lý xong)
 * - Fallback tiếp về chữ cái đầu tên nếu không có ảnh
 *
 * Variant mặc định theo size:
 *  size ≤ 40px   → thumb
 *  size ≤ 96px   → medium
 *  size > 96px   → large
 */
export default function UserAvatar({
  src,
  name,
  size = 40,
  variant,
  className,
  online,
}: UserAvatarProps) {
  const resolvedVariant: ImageVariant =
    variant ?? (size <= 40 ? 'thumb' : size <= 96 ? 'medium' : 'large');

  const variantSrc = getVariantUrl(src, resolvedVariant);

  // Fallback chain: variant → original → letter
  const [imgSrc, setImgSrc] = useState<string | undefined>(variantSrc ?? src ?? undefined);
  const [usedFallback, setUsedFallback] = useState(false);

  // Sync imgSrc khi src prop thay đổi (vd: sau khi cập nhật avatar)
  useEffect(() => {
    const newSrc = getVariantUrl(src, resolvedVariant) ?? src ?? undefined;
    setImgSrc(newSrc);
    setUsedFallback(false);
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  const letter = name?.charAt(0)?.toUpperCase() ?? 'U';

  const handleError = () => {
    if (!usedFallback && src && imgSrc !== src) {
      setUsedFallback(true);
      setImgSrc(src);
    } else {
      setImgSrc(undefined);
    }
  };

  return (
    <div className={cn('relative flex-shrink-0', className)} style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full bg-[#0068FF] flex items-center justify-center overflow-hidden">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={name ?? 'avatar'}
            className="w-full h-full object-cover"
            onError={handleError}
          />
        ) : (
          <span
            className="text-white font-bold select-none"
            style={{ fontSize: Math.max(10, size * 0.35) }}
          >
            {letter}
          </span>
        )}
      </div>

      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            online ? 'bg-green-400' : 'bg-gray-300'
          )}
          style={{ width: Math.max(8, size * 0.25), height: Math.max(8, size * 0.25) }}
        />
      )}
    </div>
  );
}

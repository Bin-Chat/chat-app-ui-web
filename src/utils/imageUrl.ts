/**
 * Helpers for resolving Lambda image-processor variant URLs.
 *
 * Lambda tạo 3 variant từ mỗi ảnh gốc:
 *   <base>__thumb.webp   — 128×128 cover crop   (dùng trong danh sách, avatar nhỏ)
 *   <base>__medium.webp  — max 512px giữ tỉ lệ  (avatar profile, ảnh chat inline)
 *   <base>__large.webp   — max 1080px giữ tỉ lệ (lightbox, xem ảnh full)
 *
 * Nếu variant chưa tồn tại (Lambda chưa xử lý xong), fallback về URL gốc.
 */

export type ImageVariant = 'thumb' | 'medium' | 'large';

/**
 * Trả về URL của một variant cụ thể.
 * Nếu `url` undefined/null/rỗng → trả về undefined.
 * Nếu url đã là variant (có `__thumb|__medium|__large`) → trả về nguyên vẹn.
 *
 * @example
 * getVariantUrl("https://cdn.example.com/avatars/user1/2026/03/abc.jpg", "thumb")
 * // → "https://cdn.example.com/avatars/user1/2026/03/abc__thumb.webp"
 */
export function getVariantUrl(
  url: string | null | undefined,
  variant: ImageVariant
): string | undefined {
  if (!url) return undefined;

  // Đã là variant rồi → trả về nguyên
  if (/__thumb|__medium|__large/.test(url)) return url;

  const dotIdx = url.lastIndexOf('.');
  const base = dotIdx !== -1 ? url.slice(0, dotIdx) : url;
  return `${base}__${variant}.webp`;
}

/**
 * Tự động chọn variant phù hợp theo `size` (chiều rộng container tính bằng px).
 * - size ≤ 160  → thumb
 * - size ≤ 600  → medium
 * - size > 600  → large
 */
export function getResponsiveImageUrl(
  url: string | null | undefined,
  containerWidth: number
): string | undefined {
  if (!url) return undefined;
  if (containerWidth <= 160) return getVariantUrl(url, 'thumb');
  if (containerWidth <= 600) return getVariantUrl(url, 'medium');
  return getVariantUrl(url, 'large');
}

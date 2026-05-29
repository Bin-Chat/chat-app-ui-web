import authorizedAxios from '@/utils/authorizedAxios';

export type AttachmentFileCategory = 'image' | 'video' | 'file' | 'voice';

export interface UploadedAttachment {
  url: string;
  type: AttachmentFileCategory;
  filename: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  duration?: number;
}

interface PresignResponse {
  presignedUrl: string;
  objectKey: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

interface FinalizeResponse {
  objectKey: string;
  cdnUrl: string;
  category: string;
  size: number;
  contentType: string;
}

function getCategory(mimeType: string): AttachmentFileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'voice';
  return 'file';
}

function getUploadCategory(mimeType: string): 'image' | 'video' | 'document' | 'audio' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

/**
 * Upload a File/Blob to S3 via presigned URL, then finalize with the backend.
 */
export async function uploadFile(
  file: File | Blob,
  filename: string,
  mimeType: string,
  onProgress?: (pct: number) => void
): Promise<UploadedAttachment> {
  const uploadCategory = getUploadCategory(mimeType);
  const attachmentType = getCategory(mimeType);

  // 1. Get presigned PUT URL
  const { data: presign } = await authorizedAxios.post<PresignResponse>('/api/uploads/presign', {
    filename,
    mimeType,
    fileSize: file.size,
    category: uploadCategory,
  });

  // 2. Upload directly to S3 (with optional XHR progress)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presign.presignedUrl);
    xhr.setRequestHeader('Content-Type', mimeType);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90));
      };
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('S3 upload network error'));
    xhr.send(file);
  });

  // 3. Finalize
  const { data: finalize } = await authorizedAxios.post<FinalizeResponse>('/api/uploads/finalize', {
    objectKey: presign.objectKey,
    category: uploadCategory,
  });

  if (onProgress) onProgress(100);

  return {
    url: finalize.cdnUrl,
    type: attachmentType,
    filename,
    size: finalize.size || file.size,
    mimeType,
  };
}

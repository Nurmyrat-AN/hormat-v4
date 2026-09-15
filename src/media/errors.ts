export type MediaCode = 'MEDIA_FILE_REQUIRED' | 'MEDIA_FILE_TOO_LARGE' | 'MEDIA_TYPE_NOT_ALLOWED' | 'MEDIA_FILE_INVALID' | 'MEDIA_UPLOAD_FAILED' | 'MEDIA_CACHE_NOT_FOUND';
export class MediaError extends Error {
  constructor(readonly code: MediaCode) { super(code); }
}

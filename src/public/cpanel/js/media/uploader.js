(() => {
  const inlineTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']);
  class MediaUploader {
    constructor(element) {
      this.element = element;
      this.existingUrl = element.dataset.existingUrl || null;
      this.state = 'idle'; this.cacheToken = null; this.url = null; this.uploadPromise = null; this.error = null; this.progress = 0;
      this.revision = 0; this.file = null; this.xhr = null; this.media = null;
      this.input = element.querySelector('[data-upload-input]');
      this.preview = element.querySelector('[data-media-preview]');
      element.querySelector('[data-upload-choose]').disabled = false;
      element.querySelector('[data-upload-choose]').addEventListener('click', () => this.input.click());
      this.input.addEventListener('change', () => { if (this.input.files[0]) this.select(this.input.files[0]); });
      element.querySelector('[data-upload-remove]').addEventListener('click', () => this.remove());
      element.querySelector('[data-upload-retry]').addEventListener('click', () => { if (this.file) this.select(this.file); });
      this.preview.addEventListener('error', () => { this.preview.hidden = true; });
      element.mediaUploader = this;
    }
    message(code) {
      const attribute = { MEDIA_FILE_REQUIRED: 'required', MEDIA_FILE_TOO_LARGE: 'tooLarge', MEDIA_TYPE_NOT_ALLOWED: 'typeNotAllowed', MEDIA_FILE_INVALID: 'invalid', MEDIA_UPLOAD_FAILED: 'failed' }[code] || 'failed';
      return this.element.dataset[attribute];
    }
    render() {
      const e = this.element, status = e.querySelector('[data-upload-status]');
      e.dataset.uploadState = this.state;
      status.textContent = this.state === 'error' ? this.message(this.error) : this.state === 'uploading' ? e.dataset.uploading : this.state === 'uploaded' ? e.dataset.uploaded : '';
      status.hidden = this.state === 'idle';
      e.querySelector('[data-upload-remove]').hidden = this.state === 'idle';
      e.querySelector('[data-upload-retry]').hidden = this.state !== 'error';
      e.querySelector('[data-upload-progress]').hidden = this.state !== 'uploading';
      const progress = e.querySelector('progress');
      if (this.progress === null) progress.removeAttribute('value'); else progress.value = this.progress;
      e.querySelector('[data-upload-percent]').textContent = this.progress === null ? '' : `${this.progress}%`;
      const previewUrl = this.state === 'uploaded' && inlineTypes.has(this.media?.mimeType) ? this.url : this.existingUrl;
      if (previewUrl) { this.preview.src = previewUrl; this.preview.hidden = false; } else { this.preview.removeAttribute('src'); this.preview.hidden = true; }
      const link = e.querySelector('[data-upload-file]');
      link.hidden = this.state !== 'uploaded';
      if (this.state === 'uploaded') {
        link.href = this.url; link.download = this.media.originalName;
        e.querySelector('[data-upload-name]').textContent = this.media.originalName;
      } else link.removeAttribute('href');
    }
    remove() {
      this.revision++; this.xhr?.abort(); this.xhr = null;
      this.state = 'idle'; this.cacheToken = null; this.url = null; this.uploadPromise = null; this.error = null; this.media = null; this.progress = 0; this.file = null; this.input.value = '';
      this.render();
    }
    select(file) {
      this.remove(); this.file = file;
      const revision = this.revision;
      if (Number(this.element.dataset.maxBytes) > 0 && file.size > Number(this.element.dataset.maxBytes)) {
        this.state = 'error'; this.error = 'MEDIA_FILE_TOO_LARGE'; this.render(); return;
      }
      this.state = 'uploading'; this.render();
      const pending = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest(); this.xhr = xhr;
        const finishError = code => {
          if (revision === this.revision) { this.state = 'error'; this.error = code; this.cacheToken = null; this.url = null; this.uploadPromise = null; this.xhr = null; this.render(); }
          reject(new Error(code));
        };
        xhr.open('POST', '/cpanel/media/upload'); xhr.timeout = 300000;
        xhr.setRequestHeader('X-CSRF-Token', this.element.dataset.csrf);
        xhr.upload.onprogress = event => {
          if (revision !== this.revision) return;
          this.progress = event.lengthComputable ? Math.min(100, Math.floor(event.loaded / event.total * 100)) : null;
          this.render();
        };
        xhr.onerror = xhr.ontimeout = xhr.onabort = () => finishError('MEDIA_UPLOAD_FAILED');
        xhr.onload = () => {
          if (revision !== this.revision) { reject(new Error('MEDIA_UPLOAD_FAILED')); return; }
          let response; try { response = JSON.parse(xhr.responseText); } catch { finishError('MEDIA_UPLOAD_FAILED'); return; }
          const media = response.media;
          if (xhr.status !== 201 || response.success !== true || !media || typeof media.cacheToken !== 'string' || typeof media.url !== 'string' || !/^\/media\/cache\/[a-z0-9.-]+$/.test(media.url)) { finishError(response.error?.code || 'MEDIA_UPLOAD_FAILED'); return; }
          this.state = 'uploaded'; this.cacheToken = media.cacheToken; this.url = media.url; this.media = media; this.uploadPromise = null; this.error = null; this.xhr = null;
          this.progress = 100; this.render(); resolve(media);
        };
        const form = new FormData(); form.append('file', file);
        try { xhr.send(form); } catch { finishError('MEDIA_UPLOAD_FAILED'); }
      });
      // Selection can finish before any Save; callers still receive the original rejecting promise.
      this.uploadPromise = this.state === 'uploading' ? pending : null;
      pending.catch(() => undefined);
    }
    /** Shared Save gate. The callback maps tokens to its domain's field names; no URL is authoritative. */
    static createSaveHandler(uploaders, save, button) {
      let pending = false;
      return async event => {
        event?.preventDefault(); if (pending) return;
        pending = true; if (button) button.disabled = true;
        try {
          while (uploaders.some(u => u.state === 'uploading')) await Promise.allSettled(uploaders.map(u => u.uploadPromise).filter(Boolean));
          if (uploaders.some(u => u.state === 'error')) { uploaders.forEach(u => u.render()); return; }
          await save(uploaders.map(u => u.state === 'uploaded' ? u.cacheToken : null));
        } finally { pending = false; if (button) button.disabled = false; }
      };
    }
  }
  window.HormatMediaUploader = MediaUploader;
  document.querySelectorAll('[data-media-uploader]').forEach(element => new MediaUploader(element));
})();

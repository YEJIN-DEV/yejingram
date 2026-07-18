import { useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';
import type { StoredFileRef } from '../../entities/message/types';
import { getBlob, makeBinaryUrl } from '../../services/binaryStore';
import { getCachedImageDims, setCachedImageDims } from '../../utils/imageDims';

export function FilePreview({
  file,
  preview,
  t,
  previewSrc,
  onResolveImageUrl,
  onImageDims,
}: {
  file: StoredFileRef;
  preview: boolean;
  t: (key: string) => string;
  previewSrc?: string;
  onResolveImageUrl?: (url: string) => void;
  onImageDims?: (width: number, height: number) => void;
}) {
  const mimeType = file.mimeType;
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    let createdUrl: string | null = null;

    async function run() {
      const blob = await getBlob(file.storageKey);
      if (canceled) return;
      if (!blob) {
        setObjectUrl(null);
        return;
      }

      if (mimeType.startsWith('image/')) {
        // Use stable URL (served from SW/Cache Storage).
        createdUrl = null;
        const stable = makeBinaryUrl(file.storageKey);
        setObjectUrl(stable);
        onResolveImageUrl?.(stable);
        return;
      }

      createdUrl = URL.createObjectURL(blob);
      setObjectUrl(createdUrl);
    }

    run();

    return () => {
      canceled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [file.storageKey, mimeType, onResolveImageUrl]);

  const src = objectUrl || previewSrc || null;

  if (mimeType.startsWith('image/')) {
    // Known natural size (from the message or the session cache) lets us reserve
    // the final layout box before the blob resolves, so virtualized list items
    // keep a stable height and the scroll position doesn't jump.
    const dims = (file.width && file.height)
      ? { width: file.width, height: file.height }
      : getCachedImageDims(file.storageKey);

    if (!src) {
      if (!preview && dims) {
        return (
          <div
            className="max-w-64 bg-(--color-button-secondary-accent) rounded-lg"
            style={{ width: dims.width, aspectRatio: `${dims.width} / ${dims.height}` }}
          />
        );
      }
      return (
        <div className="flex flex-col items-center justify-center h-24 bg-(--color-button-secondary-accent) rounded-lg">
          <StickyNote className="w-8 h-8 text-(--color-icon-tertiary)" />
          <span className="text-sm text-(--color-text-tertiary) mt-1">{t('main.filePreview.loading')}</span>
        </div>
      );
    }
    return (
      <img
        src={src}
        {...(!preview && dims ? { width: dims.width, height: dims.height } : {})}
        className={`${preview ? 'max-w-full max-h-32' : 'max-w-64 h-auto'} object-contain rounded-lg`}
        alt={t('main.filePreview.alt')}
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth > 0 && el.naturalHeight > 0) {
            setCachedImageDims(file.storageKey, { width: el.naturalWidth, height: el.naturalHeight });
            onImageDims?.(el.naturalWidth, el.naturalHeight);
          }
        }}
      />
    );
  }

  if (mimeType.startsWith('audio/')) {
    if (!src) {
      return (
        <div className="w-64 bg-linear-to-r from-(--color-preview-from) to-(--color-preview-to) p-4 rounded-lg border border-(--color-preview-border)">
          <p className="text-sm font-medium text-(--color-text-primary)">{t('main.filePreview.audioFile')}</p>
          <p className="text-xs text-(--color-text-secondary)">{t('main.filePreview.loading')}</p>
        </div>
      );
    }
    return (
      <div className="w-64 bg-linear-to-r from-(--color-preview-from) to-(--color-preview-to) p-4 rounded-lg border border-(--color-preview-border)">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-linear-to-br from-(--color-preview-accent-from) to-(--color-preview-accent-to) rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-(--color-text-accent)" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M13.071 8.929a1 1 0 011.414 0A5.983 5.983 0 0116 12a5.983 5.983 0 01-1.515 3.071 1 1 0 11-1.414-1.414A3.983 3.983 0 0014 12a3.983 3.983 0 00-.929-2.657 1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-(--color-text-primary)">{t('main.filePreview.audioFile')}</p>
            <p className="text-xs text-(--color-text-secondary)">{t('main.filePreview.clickToPlay')}</p>
          </div>
        </div>
        <audio
          controls
          src={src}
          className="w-full h-8 rounded-md"
          style={{
            filter: 'sepia(20%) saturate(70%) hue-rotate(315deg) brightness(95%) contrast(105%)',
          }}
        />
      </div>
    );
  }

  if (mimeType.startsWith('video/')) {
    if (!src) {
      return (
        <div className="flex flex-col items-center justify-center h-24 bg-(--color-button-secondary-accent) rounded-lg">
          <StickyNote className="w-8 h-8 text-(--color-icon-tertiary)" />
          <span className="text-sm text-(--color-text-tertiary) mt-1">{t('main.filePreview.loading')}</span>
        </div>
      );
    }
    return (
      <video
        src={src}
        className="max-w-full max-h-32 object-contain rounded-lg cursor-pointer"
        onClick={(e) => {
          const video = e.currentTarget;
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-24 bg-(--color-button-secondary-accent) rounded-lg">
      <StickyNote className="w-8 h-8 text-(--color-icon-tertiary)" />
      <span className="text-sm text-(--color-text-tertiary) mt-1">
        {'name' in file && file.name ? (file.name.length > 14 ? file.name.slice(0, 14) + '...' : file.name) : 'File'}
      </span>
    </div>
  );
}
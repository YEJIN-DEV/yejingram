// Natural image dimensions, keyed by binary storageKey.
// Virtualized message lists remount items on scroll; knowing dimensions up front
// lets us reserve layout space before the image loads and avoid scroll jumps.
export type ImageDims = { width: number; height: number };

const dimsCache = new Map<string, ImageDims>();

export function getCachedImageDims(storageKey: string): ImageDims | null {
    return dimsCache.get(storageKey) ?? null;
}

export function setCachedImageDims(storageKey: string, dims: ImageDims): void {
    if (dims.width > 0 && dims.height > 0) {
        dimsCache.set(storageKey, dims);
    }
}

export async function measureImageBlob(blob: Blob): Promise<ImageDims | null> {
    try {
        if (typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(blob);
            const dims = { width: bitmap.width, height: bitmap.height };
            bitmap.close();
            if (dims.width > 0 && dims.height > 0) return dims;
        }
    } catch {
        // fall through to <img> based measurement
    }

    if (typeof Image === 'undefined' || typeof URL === 'undefined') return null;

    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img.naturalWidth > 0 && img.naturalHeight > 0
                ? { width: img.naturalWidth, height: img.naturalHeight }
                : null);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        img.src = url;
    });
}

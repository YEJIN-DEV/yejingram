const HEADER_PIXELS = 8; // 첫 8픽셀을 헤더로 사용
const MARK = [0x50, 0x43, 0x41, 0x52] as const; // 'P','C','A','R'

export function encodeTextInImage(imageData: ImageData, text: string): ImageData {
    const data = imageData.data;
    const textBytes = new TextEncoder().encode(text);
    const textLength = textBytes.length;
    const availableDataPixels = data.length / 4 - HEADER_PIXELS;

    if (textLength > availableDataPixels) {
        throw new Error("이미지가 너무 작거나 텍스트가 너무 깁니다.");
    }

    // MARK ('PCAR') in A channel of first 4 pixels (indexes 3,7,11,15)
    data[3] = MARK[0];
    data[7] = MARK[1];
    data[11] = MARK[2];
    data[15] = MARK[3];

    // length (big-endian) in A channel of next 4 pixels (indexes 19,23,27,31)
    data[19] = (textLength >> 24) & 0xff;
    data[23] = (textLength >> 16) & 0xff;
    data[27] = (textLength >> 8) & 0xff;
    data[31] = textLength & 0xff;

    // payload bytes -> A channel starting at pixel index HEADER_PIXELS
    for (let i = 0; i < textLength; i++) {
        data[(HEADER_PIXELS + i) * 4 + 3] = textBytes[i];
    }

    return imageData;
}

export function decodeTextFromImage(imageData: ImageData): string | null {
    const data = imageData.data;

    // check MARK
    if (
        data[3] !== MARK[0] ||
        data[7] !== MARK[1] ||
        data[11] !== MARK[2] ||
        data[15] !== MARK[3]
    ) {
        return null;
    }

    // read big-endian length
    const textLength =
        ((data[19] << 24) >>> 0) | ((data[23] << 16) >>> 0) | ((data[27] << 8) >>> 0) | (data[31] >>> 0);

    if (textLength <= 0 || textLength > data.length / 4 - HEADER_PIXELS) {
        return null;
    }

    const textBytes = new Uint8Array(textLength);
    for (let i = 0; i < textLength; i++) {
        textBytes[i] = data[(HEADER_PIXELS + i) * 4 + 3];
    }

    try {
        return new TextDecoder().decode(textBytes);
    } catch {
        return null;
    }
}

// 도우미: <img src|file>을 캔버스 ImageData로 변환
export async function getImageDataFromSrc(src: string): Promise<ImageData> {
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D 컨텍스트를 가져올 수 없습니다.");
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function imageDataToDataURL(imageData: ImageData, mime: string = "image/png"): string {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D 컨텍스트를 가져올 수 없습니다.");
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL(mime);
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // 로컬 업로드 data URL이면 crossOrigin 불필요. 외부 URL이면 필요할 수 있음.
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error("이미지를 불러올 수 없습니다."));
        img.src = src;
    });
}

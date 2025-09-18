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

export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // 로컬 업로드 data URL이면 crossOrigin 불필요. 외부 URL이면 필요할 수 있음.
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
        img.src = src;
    });
}

// ===== 신규(IEND 뒤 trailer) 방식: 기본 상수 =====
const PNG_SIG = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // \x89PNG\r\n\x1A\n
const TRAILER_MAGIC = new Uint8Array([0x50, 0x43, 0x41, 0x52]); // 'P','C','A','R' (기존 MARK와 동일)

// trailer 포맷(파일의 끝부분):
// [payload bytes][ 'PCAR'(4) ][ length(4, big-endian) ]
// => 마지막 8바이트로 존재 여부/길이를 빠르게 판별 가능

// ===== 유틸: 문자열<->바이트 =====
function utf8Encode(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}
function utf8Decode(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}

// ===== 유틸: 숫자<->4바이트(BE) =====
function u32ToBE(n: number): Uint8Array {
    const out = new Uint8Array(4);
    out[0] = (n >>> 24) & 0xff;
    out[1] = (n >>> 16) & 0xff;
    out[2] = (n >>> 8) & 0xff;
    out[3] = n & 0xff;
    return out;
}
function beToU32(b0: number, b1: number, b2: number, b3: number): number {
    // >>> 0 로 부호 없는 32비트로
    return (((b0 << 24) >>> 0) | ((b1 << 16) >>> 0) | ((b2 << 8) >>> 0) | (b3 >>> 0)) >>> 0;
}

// ===== 유틸: DataURL/Blob/바이트 변환 =====
async function fetchBytes(src: string): Promise<Uint8Array> {
    const res = await fetch(src);
    if (!res.ok) throw new Error("PNG 바이트를 가져오지 못했습니다.");
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
}

function exactArrayBuffer(view: Uint8Array): ArrayBuffer {
    // view.buffer 가 SharedArrayBuffer 일 수도 있으니, 해당 구간만 복사해 ArrayBuffer 로 보장
    const { buffer, byteOffset, byteLength } = view;
    const ab = new ArrayBuffer(byteLength);
    new Uint8Array(ab).set(new Uint8Array(buffer, byteOffset, byteLength));
    return ab;
}

function isPng(bytes: Uint8Array): boolean {
    if (bytes.length < 8) return false;
    for (let i = 0; i < 8; i++) {
        if (bytes[i] !== PNG_SIG[i]) return false;
    }
    return true;
}

export async function bytesToDataURLPNGAsync(bytes: Uint8Array): Promise<string> {
    const blob = new Blob([exactArrayBuffer(bytes)], { type: "image/png" });
    return new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = () => reject(fr.error ?? new Error("DataURL 생성 실패"));
        fr.readAsDataURL(blob);
    });
}

export function appendTrailerToPng(pngBytes: Uint8Array, text: string): Uint8Array {
    // 1) PNG 시그니처 확인
    if (!isPng(pngBytes)) {
        throw new Error("PNG 파일이 아닙니다. (신규 방식은 PNG에서만 사용 가능합니다)");
    }

    // 2) payload 준비
    const payload = utf8Encode(text);
    const lenBE = u32ToBE(payload.length);

    // 3) 신규 바이트 = 기존 PNG + payload + MAGIC + length(4BE)
    const out = new Uint8Array(pngBytes.length + payload.length + 4 + 4);
    out.set(pngBytes, 0);
    out.set(payload, pngBytes.length);
    out.set(TRAILER_MAGIC, pngBytes.length + payload.length);
    out.set(lenBE, pngBytes.length + payload.length + 4);
    return out;
}

export function extractTrailerFromPng(pngOrWithTrailer: Uint8Array): string | null {
    // PNG 시그니처 확인
    if (!isPng(pngOrWithTrailer)) {
        return null; // PNG가 아니면 신규 방식은 패스
    }
    if (pngOrWithTrailer.length < 8 + 8) { // 최소: 시그니처 + trailer(8)
        return null;
    }

    // 마지막 8바이트: [MAGIC(4)][LEN(4)]
    const tail = pngOrWithTrailer.slice(pngOrWithTrailer.length - 8);
    const magicOk = TRAILER_MAGIC.every((v, i) => v === tail[i]);
    if (!magicOk) return null;

    const len = beToU32(tail[4], tail[5], tail[6], tail[7]);
    if (len === 0) return "";

    const start = pngOrWithTrailer.length - 8 - len;
    if (start < 0) return null;

    const payload = pngOrWithTrailer.slice(start, start + len);
    try {
        return utf8Decode(payload);
    } catch {
        return null;
    }
}


// ===== 자동 전환 래퍼 =====
// 정책:
//  - 소스가 PNG면: 1) 먼저 trailer(신규) 시도 -> 성공이면 그 결과 사용
//                 2) 실패 시 알파 채널(기존) 디코딩 시도
//  - 인코딩 시에도 PNG면 신규 방식을 우선 사용, PNG가 아니면 기존 방식 사용
type EncodeMethod = "png-trailer" | "alpha-channel";
export async function encodeText(src: string, text: string, method: EncodeMethod): Promise<string> {
    let bytes: Uint8Array = await fetchBytes(src);

    if (method === "png-trailer") {
        // PNG가 아니면 먼저 PNG로 변환 (캔버스 -> PNG DataURL -> 바이트)
        if (!isPng(bytes)) {
            const imageData = await getImageDataFromSrc(src);
            const pngDataUrl = imageDataToDataURL(imageData, "image/png");
            bytes = await fetchBytes(pngDataUrl);
        }
        const out = appendTrailerToPng(bytes, text);
        return await bytesToDataURLPNGAsync(out);
    } else {
        const imageData = await getImageDataFromSrc(src);
        const encoded = encodeTextInImage(imageData, text);
        return imageDataToDataURL(encoded, "image/png");
    }

}

export async function decodeText(src: string): Promise<{ text: string | null; method: EncodeMethod }> {
    let bytes: Uint8Array = await fetchBytes(src);

    const t = extractTrailerFromPng(bytes);
    if (t !== null) {
        return { text: t, method: "png-trailer" };
    } else {
        const imageData = await getImageDataFromSrc(src);
        const text = decodeTextFromImage(imageData);
        return { text, method: "alpha-channel" };
    }
}

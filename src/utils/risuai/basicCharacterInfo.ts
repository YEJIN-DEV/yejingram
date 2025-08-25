import * as fflate from 'fflate';

export type BasicCharacterInfo = {
    spec: 'chara_card_v2' | 'chara_card_v3' | 'offspec' | 'unknown'
    spec_version?: string
    name: string
    description?: string
    personality?: string
    scenario?: string
    first_mes?: string
    creator?: string
    tags?: string[]
    character_version?: string | number
    hasLore?: boolean
    hasEmotion?: boolean
    hasAsset?: boolean
    // Optional avatar image as Data URL (when derivable from input)
    avatarDataUrl?: string
}

// Minimal shapes used for type narrowing only
interface CharacterBookMini { entries?: any[] }
interface CardDataBaseMini {
    name?: string
    description?: string
    personality?: string
    scenario?: string
    first_mes?: string
    tags?: string[]
    creator?: string
    character_version?: string | number
    character_book?: CharacterBookMini
    extensions?: any
}
interface CharacterCardV2Mini { spec: 'chara_card_v2'; spec_version?: string; data: CardDataBaseMini }
interface CharacterCardV3Mini { spec: 'chara_card_v3'; spec_version?: string; data: CardDataBaseMini & { assets?: any[] } }

type AnyCard = CharacterCardV2Mini | CharacterCardV3Mini

interface OldTavernChar {
    name: string
    description: string
    personality: string
    scenario: string
    first_mes: string
    spec_version?: '1.0'
}

// Base64 -> UTF-8 string (browser safe)
function b64ToUtf8(b64: string): string {
    const bin = atob(b64)
    const len = bin.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
}

// Find end offset of IEND chunk (offset right after IEND's CRC). Fallback to bytes.length
function findIendEndOffset(bytes: Uint8Array): number {
    // PNG signature
    const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    for (let i = 0; i < 8; i++) {
        if (bytes[i] !== sig[i]) return bytes.length
    }
    let offset = 8
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const td = new TextDecoder()
    while (offset + 8 <= bytes.length) {
        const length = dv.getUint32(offset)
        offset += 4
        if (offset + 4 > bytes.length) return bytes.length
        const typeBytes = bytes.subarray(offset, offset + 4)
        offset += 4
        if (offset + length + 4 > bytes.length) return bytes.length
        // skip data
        offset += length
        // skip CRC
        offset += 4
        const type = td.decode(typeBytes)
        if (type === 'IEND') return offset
    }
    return bytes.length
}

// Extract base64 payload following given ASCII signature (e.g., 'ccv3', 'chara') before IEND.
// Find signature position within PNG (before IEND)
function findSignaturePos(bytes: Uint8Array, signature: string, from = 0, endLimit?: number): number {
    const end = Math.min(findIendEndOffset(bytes), endLimit ?? Number.MAX_SAFE_INTEGER)
    const sig = new TextEncoder().encode(signature)
    const slen = sig.length
    for (let i = Math.max(0, from); i <= end - slen; i++) {
        let ok = true
        for (let j = 0; j < slen; j++) {
            if (bytes[i + j] !== sig[j]) { ok = false; break }
        }
        if (ok) return i
    }
    return -1
}

// Extract base64 payload after a signature until endLimit (or IEND)
function extractAfterSignature(bytes: Uint8Array, signature: string, from = 0, endLimit?: number): { payload: string, pos: number } | null {
    const isB64 = (c: number) => (
        (c >= 0x41 && c <= 0x5A) || // A-Z
        (c >= 0x61 && c <= 0x7A) || // a-z
        (c >= 0x30 && c <= 0x39) || // 0-9
        c === 0x2B || // +
        c === 0x2F || // /
        c === 0x3D    // =
    )
    const isSep = (c: number) => (
        c === 0x00 || c === 0x3A || c === 0x3D || c === 0x20 || c === 0x7C || // NUL : = space |
        c === 0x09 || c === 0x0A || c === 0x0D // tab, lf, cr
    )
    const startPos = findSignaturePos(bytes, signature, from, endLimit)
    if (startPos < 0) return null
    const hardEnd = Math.min(findIendEndOffset(bytes), endLimit ?? Number.MAX_SAFE_INTEGER)
    let k = startPos + signature.length
    while (k < hardEnd && isSep(bytes[k])) k++
    let collected = ''
    let count = 0
    const MAX = 5 * 1024 * 1024 // 5MB of base64 text
    while (k < hardEnd && isB64(bytes[k]) && count < MAX) {
        collected += String.fromCharCode(bytes[k])
        k++; count++
    }
    if (collected.length > 0) return { payload: collected, pos: startPos }
    return null
}

// Read binary from File/Uint8Array/ReadableStream
async function readAllBytes(data: Uint8Array | File | ReadableStream<Uint8Array>): Promise<Uint8Array> {
    if (data instanceof Uint8Array) return data
    if (typeof File !== 'undefined' && data instanceof File) {
        return new Uint8Array(await data.arrayBuffer())
    }
    // ReadableStream
    const reader = (data as ReadableStream<Uint8Array>).getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (!value) continue
        chunks.push(value)
        total += value.byteLength
    }
    const out = new Uint8Array(total)
    let offset = 0
    for (const c of chunks) {
        out.set(c, offset)
        offset += c.byteLength
    }
    return out
}

// Convert raw bytes to Data URL
async function bytesToDataURL(u8: Uint8Array, mime: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const ab = new ArrayBuffer(u8.byteLength)
        new Uint8Array(ab).set(u8)
        const blob = new Blob([ab], { type: mime })
        const r = new FileReader()
        r.onload = () => resolve(String(r.result || ''))
        r.onerror = reject
        r.readAsDataURL(blob)
    })
}

function extractFromCard(card: AnyCard): BasicCharacterInfo {
    const d: any = card.data as any
    const assets = (card as any)?.data?.assets as any[] | undefined
    const hasEmotion = Array.isArray(assets) ? assets.some(a => a?.type === 'emotion') : Array.isArray(d?.extensions?.risuai?.emotions) && d.extensions.risuai.emotions.length > 0
    const hasAsset = Array.isArray(assets)
        ? assets.some(a => a?.type === 'x-risu-asset' || a?.type === 'icon')
        : (Array.isArray(d?.extensions?.risuai?.additionalAssets) && d.extensions.risuai.additionalAssets.length > 0)
    const hasLore = !!d?.character_book && Array.isArray(d.character_book.entries) && d.character_book.entries.length > 0

    return {
        spec: card.spec,
        spec_version: (card as any).spec_version,
        name: d?.name ?? '',
        description: d?.description ?? '',
        personality: d?.personality ?? '',
        scenario: d?.scenario ?? '',
        first_mes: d?.first_mes ?? '',
        creator: d?.creator ?? '',
        tags: d?.tags ?? [],
        character_version: d?.character_version,
        hasLore,
        hasEmotion,
        hasAsset,
    }
}

function extractFromOldTavern(ch: OldTavernChar): BasicCharacterInfo {
    return {
        spec: 'offspec',
        spec_version: ch.spec_version,
        name: ch.name ?? '',
        description: ch.description ?? '',
        personality: ch.personality ?? '',
        scenario: ch.scenario ?? '',
        first_mes: ch.first_mes ?? '',
        creator: undefined,
        tags: [],
        character_version: undefined,
        hasLore: false,
        hasEmotion: false,
        hasAsset: false,
    }
}

// Public API
export async function extractBasicCharacterInfo(input: {
    name: string
    data: Uint8Array | File | ReadableStream<Uint8Array>
}): Promise<BasicCharacterInfo | null> {
    const lowerName = (input.name || '').toLowerCase()

    // JSON
    if (lowerName.endsWith('.json')) {
        try {
            const bytes = await readAllBytes(input.data)
            const obj = JSON.parse(new TextDecoder().decode(bytes))
            if (obj?.spec === 'chara_card_v2' || obj?.spec === 'chara_card_v3') {
                return extractFromCard(obj as AnyCard)
            }
            return extractFromOldTavern(obj as OldTavernChar)
        } catch {
            return null
        }
    }

    // CharX / JPEG with CharX
    if (lowerName.endsWith('.charx') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        try {
            const bytes = await readAllBytes(input.data)
            // If JPEG-embedded ZIP, find PK header and slice
            const pk = [0x50, 0x4B, 0x03, 0x04]
            let start = 0
            for (let i = 0; i <= bytes.length - 4; i++) {
                if (bytes[i] === pk[0] && bytes[i + 1] === pk[1] && bytes[i + 2] === pk[2] && bytes[i + 3] === pk[3]) {
                    start = i; break
                }
            }
            const zipBytes = bytes.subarray(start)

            const out: Record<string, Uint8Array> = fflate.unzipSync(zipBytes)
            if (!out) return null
            const names = Object.keys(out)
            const cardName = names.find(n => n.toLowerCase().endsWith('card.json'))
            if (!cardName) return null
            const text = fflate.strFromU8(out[cardName])
            const card = JSON.parse(text)
            if (card?.spec === 'chara_card_v2' || card?.spec === 'chara_card_v3') {
                const base = extractFromCard(card as AnyCard)
                // Try to extract avatar from ZIP
                let avatarDataUrl: string | undefined
                // Prioritize common Risu CharX icon paths
                const pick =
                    // assets/icon/image/*.png
                    names.find(n => /(^|\/)assets\/(?:.+\/)?icon\/image\/.*\.png$/i.test(n));
                if (pick) {
                    avatarDataUrl = await bytesToDataURL(out[pick], 'image/png')
                } else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
                    // Fallback: original JPEG body before ZIP (if any)
                    if (start > 0) {
                        const jpegBody = bytes.subarray(0, start)
                        avatarDataUrl = await bytesToDataURL(jpegBody, 'image/jpeg')
                    } else {
                        avatarDataUrl = await bytesToDataURL(bytes, 'image/jpeg')
                    }
                }
                return { ...base, avatarDataUrl }
            }
            return null
        } catch {
            return null
        }
    }

    // PNG (embedded char/chara v2 or ccv3)
    if (lowerName.endsWith('.png')) {
        try {
            const bytes = await readAllBytes(input.data)
            // 1) ccv3 위치와 chara 위치를 찾고, ccv3는 chara 이전까지만 읽음
            const posCcv3 = findSignaturePos(bytes, 'ccv3')
            const posChara = findSignaturePos(bytes, 'chara', posCcv3 >= 0 ? posCcv3 + 1 : 0)
            let match = posCcv3 >= 0 ? extractAfterSignature(bytes, 'ccv3', 0, (posChara >= 0 && posChara > posCcv3) ? posChara : undefined) : null
            let decoded: string | null = null
            let obj: any = null
            if (match && !match.payload.startsWith('rcc||')) {
                try {
                    decoded = b64ToUtf8(match.payload)
                    obj = JSON.parse(decoded)
                } catch {
                    decoded = null
                    obj = null
                }
            }
            // 2) ccv3 실패/부적합 시 chara로 폴백
            if (!obj) {
                match = extractAfterSignature(bytes, 'chara', (posCcv3 >= 0 && posChara >= 0) ? posChara : 0)
                if (!match) return null
                if (match.payload.startsWith('rcc||')) return null
                try {
                    decoded = b64ToUtf8(match.payload)
                    obj = JSON.parse(decoded)
                } catch {
                    return null
                }
            }
            if (obj?.spec === 'chara_card_v2' || obj?.spec === 'chara_card_v3') {
                const base = extractFromCard(obj as AnyCard)
                const avatarDataUrl = await bytesToDataURL(bytes, 'image/png')
                return { ...base, avatarDataUrl }
            }
            try {
                const off = obj as OldTavernChar
                const base = extractFromOldTavern(off)
                const avatarDataUrl = await bytesToDataURL(bytes, 'image/png')
                return { ...base, avatarDataUrl }
            } catch {
                const avatarDataUrl = await bytesToDataURL(bytes, 'image/png')
                return { spec: 'unknown', name: '', hasLore: false, hasEmotion: false, hasAsset: false, avatarDataUrl }
            }
        } catch {
            return null
        }
    }

    return null
}

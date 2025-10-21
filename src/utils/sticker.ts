import { nanoid } from '@reduxjs/toolkit';
import type { Sticker } from '../entities/character/types';

function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export async function filesToStickers(files: FileList | File[]): Promise<Sticker[]> {
    const list = Array.from(files as any as File[]);
    const results = await Promise.all(
        list.map(async (file) => {
            const data = await readFileAsDataURL(file);
            const sticker: Sticker = {
                id: nanoid(),
                name: file.name,
                data,
                type: file.type,
            };
            return sticker;
        })
    );
    return results;
}

export function formatBytes(bytes: number, decimals = 2): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Estimate raw bytes represented by a base64 string or data URL
export function estimateBase64Size(input: string): number {
    // If data URL, strip header
    let base64 = input;
    const commaIdx = input.indexOf(',');
    if (input.startsWith('data:') && commaIdx !== -1) {
        base64 = input.slice(commaIdx + 1);
    }
    // Remove any whitespace
    base64 = base64.replace(/\s/g, '');
    const len = base64.length;
    if (len === 0) return 0;
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    // Base64 decoded size in bytes
    return Math.floor((len * 3) / 4) - padding;
}

import type { Character } from "../entities/character/types";

export type PlaceholderValues = Record<string, string | Character | number | undefined> & {
    user?: string;
    char?: string;
    userName?: string;
    userDescription?: string;
    character?: Character;
    roomMemories?: string;
    guidelines?: string;
    participantDetails?: string;
    participantCount?: number;
};

export function replacePlaceholders(input: string, values: PlaceholderValues): string {
    if (!input) return input;
    let output = input;

    const timeContextValue = new Date().toLocaleString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    }) ?? 'No specific time context provided.';
    output = output.replace(/\{timeContext\}/g, timeContextValue);

    const userValue = values.userName ?? 'user';
    output = output.replace(/\{\{\s*user\s*\}\}/gi, String(userValue));
    output = output.replace(/<\s*user\s*>/gi, String(userValue));

    const charValue = values.character?.name ?? 'characters';
    output = output.replace(/\{\{\s*char\s*\}\}/gi, String(charValue));
    output = output.replace(/<\s*char\s*>/gi, String(charValue));

    const userNameValue = values.userName ?? 'Not specified. You can ask.';
    output = output.replace(/\{userName\}/g, userNameValue);

    const userDescriptionValue = values.userDescription ?? 'No specific information provided about the user.';
    output = output.replace(/\{userDescription\}/g, userDescriptionValue);

    const characterPromptValue = values.character?.prompt ?? '';
    output = output.replace(/\{characterPrompt\}/g, characterPromptValue);

    const roomMemoriesValue = values.roomMemories ?? '';
    output = output.replace(/\{roomMemories\}/g, roomMemoriesValue);

    const responseTimeValue = String(values.character?.responseTime ?? '');
    output = output.replace(/\{responseTime\}/g, responseTimeValue);

    const thinkingTimeValue = String(values.character?.thinkingTime ?? '');
    output = output.replace(/\{thinkingTime\}/g, thinkingTimeValue);

    const reactivityValue = String(values.character?.reactivity ?? '');
    output = output.replace(/\{reactivity\}/g, reactivityValue);

    const toneValue = String(values.character?.tone ?? '');
    output = output.replace(/\{tone\}/g, toneValue);

    const guidelinesValue = values.guidelines ? values.guidelines : '';
    output = output.replace(/\{guidelines\}/g, guidelinesValue);

    const participantDetailsValue = values.participantDetails ?? '';
    output = output.replace(/\{participantDetails\}/g, participantDetailsValue);

    const participantCountValue = String(values.participantCount ?? '');
    output = output.replace(/\{participantCount\}/g, participantCountValue);

    const availableStickerNames = (values.character?.stickers ?? [])
        .map(s => s.name)
        .filter(Boolean);
    output = output.replace(/\{availableStickers\}/g, availableStickerNames.length > 0 ? availableStickerNames.join(', ') : 'NO AVAILABLE STICKERS');

    return output;
}

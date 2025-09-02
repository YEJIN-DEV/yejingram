import type { Lore } from "./types";

// Parse a comma-separated string into trimmed, non-empty tokens
export function parseKeyList(input: string): string[] {
    return (input || "")
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

// OR match: true if any token is included in the haystack (case-insensitive)
export function anyMatch(haystack: string, tokens: string[]): boolean {
    const src = (haystack || "").toLowerCase();
    return tokens.some(t => src.includes(t.toLowerCase()));
}

// Evaluate whether a Lore should be active for a given text
// - alwaysActive => true
// - multiKey=false: activationKeys[0] is a comma-separated list (OR)
// - multiKey=true: activationKeys[0] OR matches AND activationKeys[1] OR matches
export function isLoreActive(lore: Lore, text: string): boolean {
    if (lore.alwaysActive) return true;

    const keyA = parseKeyList(lore.activationKeys?.[0] ?? "");
    const okA = keyA.length === 0 ? false : anyMatch(text, keyA);
    if (!lore.multiKey) return okA;

    const keyB = parseKeyList(lore.activationKeys?.[1] ?? "");
    const okB = keyB.length === 0 ? false : anyMatch(text, keyB);
    return okA && okB;
}

export function filterActiveLores(lores: Lore[], text: string): Lore[] {
    const list = lores || [];
    const always = list.filter(l => l.alwaysActive);
    const matched = list.filter(l => !l.alwaysActive && isLoreActive(l, text));
    const map = new Map<string, Lore>();
    for (const l of [...always, ...matched]) {
        map.set(l.id, l);
    }
    return Array.from(map.values());
}

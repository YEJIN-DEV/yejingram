export interface Lore {
    id: string;
    name: string;
    activationKeys: string[]; // 1 or 2 keys
    order: number;
    prompt: string;
    alwaysActive: boolean;
    multiKey: boolean; // when true, require all activationKeys to match
}

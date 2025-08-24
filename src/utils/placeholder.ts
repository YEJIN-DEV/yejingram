export type PlaceholderValues = Record<string, string | undefined> & {
    user?: string;
    char?: string;
};

export function replacePlaceholders(input: string, values: PlaceholderValues): string {
    if (!input) return input;
    let output = input;

    const userValue = values.user ?? 'user';
    // {{user}} and <user>
    output = output.replace(/\{\{\s*user\s*\}\}/gi, String(userValue));
    output = output.replace(/<\s*user\s*>/gi, String(userValue));

    const charValue = values.char ?? 'characters';
    // {{char}} and <char>
    output = output.replace(/\{\{\s*char\s*\}\}/gi, String(charValue));
    output = output.replace(/<\s*char\s*>/gi, String(charValue));

    return output;
}

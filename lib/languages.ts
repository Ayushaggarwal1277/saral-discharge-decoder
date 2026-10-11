// The languages Bulbul can speak; the explanation is only offered in these.
// `letters` matches one letter of the language's script and is used to check the model answered in it.
export const LANGUAGES = [
    { code: "hi-IN", name: "Hindi", native: "हिन्दी", script: "Devanagari", letters: /[ऀ-ॿ]/g },
    { code: "bn-IN", name: "Bengali", native: "বাংলা", script: "Bengali", letters: /[ঀ-৿]/g },
    { code: "ta-IN", name: "Tamil", native: "தமிழ்", script: "Tamil", letters: /[஀-௿]/g },
    { code: "te-IN", name: "Telugu", native: "తెలుగు", script: "Telugu", letters: /[ఀ-౿]/g },
    { code: "mr-IN", name: "Marathi", native: "मराठी", script: "Devanagari", letters: /[ऀ-ॿ]/g },
    { code: "gu-IN", name: "Gujarati", native: "ગુજરાતી", script: "Gujarati", letters: /[઀-૿]/g },
    { code: "kn-IN", name: "Kannada", native: "ಕನ್ನಡ", script: "Kannada", letters: /[ಀ-೿]/g },
    { code: "ml-IN", name: "Malayalam", native: "മലയാളം", script: "Malayalam", letters: /[ഀ-ൿ]/g },
    { code: "pa-IN", name: "Punjabi", native: "ਪੰਜਾਬੀ", script: "Gurmukhi", letters: /[਀-੿]/g },
    { code: "od-IN", name: "Odia", native: "ଓଡ଼ିଆ", script: "Odia", letters: /[଀-୿]/g },
    { code: "en-IN", name: "English", native: "English", script: "Latin", letters: /[A-Za-z]/g },
] as const;

export type Language = (typeof LANGUAGES)[number];
export type LanguageCode = Language["code"];

export function findLanguage(code: unknown): Language | null {
    return LANGUAGES.find((l) => l.code === code) ?? null;
}

/** True when most of the letters in `text` are in the language's own script rather than English letters. */
export function isWrittenIn(language: Language, text: string): boolean {
    if (language.code === "en-IN") return true;
    const own = text.match(language.letters)?.length ?? 0;
    const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
    return own > latin;
}

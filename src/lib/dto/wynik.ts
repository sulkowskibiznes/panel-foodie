/** Wynik akcji serwerowej pokazywany w interfejsie: błąd zawsze jako gotowy tekst z copy.ts. */
export type WynikAkcji = { ok: true } | { ok: false; blad: string; braki?: string[]; ostrzezenia?: string[] };

/** Proste walidatory bez zależności, używane w trasach i akcjach przed zapytaniem do bazy. */
export function czyUuid(wartosc: string | null | undefined): wartosc is string {
  return typeof wartosc === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(wartosc);
}

export function czyEmail(wartosc: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wartosc.trim());
}

import { notFound } from "next/navigation";

/**
 * JEDYNE miejsce sprawdzania izolacji klientów (CLAUDE.md, zasada 1; SPEC rozdz. 16.4).
 * Brak dostępu = 404, nigdy 403: nie potwierdzamy, że zasób istnieje.
 * Wywołuj po pobraniu zasobu po id, ZANIM cokolwiek z niego użyjesz.
 */
export function assertClientAccess(sessionClientId: string | null | undefined, resourceClientId: string | null | undefined): asserts resourceClientId is string {
  if (!sessionClientId || !resourceClientId || sessionClientId !== resourceClientId) {
    notFound();
  }
}

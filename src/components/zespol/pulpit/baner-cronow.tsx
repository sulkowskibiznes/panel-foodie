import Link from "next/link";
import { copy } from "@/lib/copy";
import type { ProblemCrona } from "@/lib/crony/monitoring";
import { formatujDateCzas } from "@/lib/format";

function opis(p: ProblemCrona): string {
  const t = copy.zespol.crony;
  const cron = t.nazwy[p.cron];
  switch (p.rodzaj) {
    case "brak":
      return t.brak.replace("{cron}", cron);
    case "opozniony":
      return t.opozniony.replace("{cron}", cron).replace("{kiedy}", formatujDateCzas(p.ostatni));
    case "bledy":
      return t.bledy.replace("{cron}", cron).replace("{n}", String(p.bledy));
    case "nieudane":
      return t.nieudane.replace("{n}", String(p.liczba));
  }
}

/** Baner dla admina na pulpicie: automaty, które stoją albo się mylą (plan domknięcia, Etap A). */
export function BanerCronow({ problemy }: { problemy: ProblemCrona[] }) {
  if (problemy.length === 0) return null;
  const t = copy.zespol.crony;
  return (
    <section role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-bursztyn" data-baner-cronow>
      <h2 className="font-semibold">{t.tytul}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {problemy.map((p) => (
          <li key={`${p.cron}-${p.rodzaj}`} data-problem-crona={`${p.cron}:${p.rodzaj}`}>
            {opis(p)}
          </li>
        ))}
      </ul>
      <Link href="/zespol/ustawienia/powiadomienia" className="mt-2 inline-block font-medium underline">
        {t.zobacz}
      </Link>
    </section>
  );
}

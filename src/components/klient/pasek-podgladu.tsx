import { copy } from "@/lib/copy";

/** Stały pasek u góry ekranu w trybie „Zobacz jak klient" (SPEC rozdz. 2): nazwa klienta i „Wyjdź". */
export function PasekPodgladu({ token, nazwaKlienta }: { token: string; nazwaKlienta: string }) {
  const p = copy.podgladKlienta;
  return (
    <div role="status" data-pasek-podgladu className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-foodie-czern px-4 py-2 text-white">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide">{p.pasek.replace("{nazwa}", nazwaKlienta)}</p>
        <p className="text-[11px] text-white/70">{p.pasekOpis}</p>
      </div>
      <form action={`/p/${token}/podglad/wyjdz`} method="post">
        <button type="submit" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-foodie-czern hover:bg-szary-100">
          {p.wyjdz}
        </button>
      </form>
    </div>
  );
}

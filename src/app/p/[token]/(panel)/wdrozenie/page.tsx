import { notFound } from "next/navigation";
import { copy } from "@/lib/copy";
import { pobierzKrokiWdrozenia } from "@/lib/dane/twoj-pakiet";
import { pobierzUstawienia } from "@/lib/dane/ustawienia";
import { formatujDate } from "@/lib/format";
import { wymagajKontekstuKlienta } from "@/lib/kontekst-klienta";
import { postepWdrozenia } from "@/lib/wdrozenie/postep";

/**
 * Wdrożenie (SPEC rozdz. 11): trasa istnieje, ale przy wyłączonej fladze `onboarding_enabled` zwraca 404
 * i nie ma jej w nawigacji. Po włączeniu: kroki z paskiem postępu, tylko do odczytu.
 */
export default async function Wdrozenie({ params }: PageProps<"/p/[token]/wdrozenie">) {
  const { token } = await params;
  const ustawienia = await pobierzUstawienia(["onboarding_enabled"]);
  const flaga = ustawienia.get("onboarding_enabled");
  if (flaga !== true && flaga !== "true") notFound();
  const kontekst = await wymagajKontekstuKlienta(token);
  const kroki = await pobierzKrokiWdrozenia(kontekst.clientId);
  const postep = postepWdrozenia(kroki.map((k) => ({ doneAt: k.zrobionoO })));
  const w = copy.wdrozenie;
  return (
    <div className="space-y-4" data-wdrozenie>
      <div>
        <h1 className="font-naglowek text-2xl text-foodie-czern sm:text-3xl">{w.tytul}</h1>
        <p className="mt-1 text-sm text-szary-600">{w.opis}</p>
      </div>
      {kroki.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-szary-600 shadow-miekki">{w.brakKrokow}</p>
      ) : (
        <>
          <div className="rounded-xl bg-white p-5 shadow-miekki">
            <p className="text-sm font-medium text-foodie-czern">{w.postep.replace("{zrobione}", String(postep.zrobione)).replace("{wszystkie}", String(postep.wszystkie))}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-szary-100" role="progressbar" aria-valuenow={postep.procent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-foodie-fiolet" style={{ width: `${postep.procent}%` }} />
            </div>
          </div>
          <ol className="space-y-3">
            {kroki.map((k) => (
              <li key={k.id} className="rounded-xl bg-white p-5 shadow-miekki">
                <p className="text-xs font-medium uppercase tracking-wide text-szary-600">{k.zrobionoO ? w.zrobione.replace("{data}", formatujDate(k.zrobionoO)) : w.doZrobienia}</p>
                <h2 className="mt-1 font-naglowek text-lg text-foodie-czern">
                  {k.pozycja}. {k.tytul}
                </h2>
                {k.opis ? <p className="mt-1 whitespace-pre-line text-sm text-szary-600">{k.opis}</p> : null}
                <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-foodie-fiolet">
                  {k.formUrl ? (
                    <a href={k.formUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {w.formularz}
                    </a>
                  ) : null}
                  {k.externalUrl ? (
                    <a href={k.externalUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {w.instrukcja}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

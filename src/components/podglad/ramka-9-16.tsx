import type { ReactNode } from "react";
import { Media } from "@/components/podglad/media";
import { czyPionowy, PROPORCJA_PIONOWA } from "@/components/podglad/typy";
import type { PlikDto } from "@/lib/dto/materialy";

/**
 * Wspólna pionowa ramka 9:16 (relacje, Reels, reklamy w relacjach i Reels, IG relacje i Reels).
 * Grafika 1:1 albo 4:5 ląduje wyśrodkowana na tle z rozmytej kopii, tak jak robi to Meta (SPEC rozdz. 7.4).
 */
export function Ramka916({ plik, gora, dol, className = "", children }: { plik: PlikDto | null; gora?: ReactNode; dol?: ReactNode; className?: string; children?: ReactNode }) {
  const pelny = czyPionowy(plik);
  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-black text-white ${className}`} style={{ aspectRatio: `${PROPORCJA_PIONOWA}` }}>
      {plik && !pelny ? (
        // eslint-disable-next-line @next/next/no-img-element -- rozmyte tło z tej samej grafiki (signed URL)
        <img src={plik.thumbUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl" />
      ) : null}
      <div className="absolute inset-0 flex items-center">
        {pelny ? <Media plik={plik} proporcja={PROPORCJA_PIONOWA} className="h-full bg-transparent" /> : <Media plik={plik} dopasowanie="zawartosc" className="bg-transparent" />}
      </div>
      {gora ? <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent">{gora}</div> : null}
      {children}
      {dol ? <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent">{dol}</div> : null}
    </div>
  );
}

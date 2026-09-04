import { inicjal, type Strona } from "@/components/podglad/typy";

/**
 * Zdjęcie profilowe strony klienta WYŁĄCZNIE wewnątrz ramki podglądu (SPEC rozdz. 7, rozdz. 14).
 * Gdy go brak: neutralne kółko z pierwszą literą nazwy strony.
 */
export function AwatarStrony({ strona, rozmiar = 40, className = "" }: { strona: Strona; rozmiar?: number; className?: string }) {
  const wspolne = `shrink-0 rounded-full ${className}`;
  if (strona.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- signed URL zmienia się co 10 min, next/image nie trafiałby w cache (decyzja D3)
    return <img src={strona.avatarUrl} alt="" width={rozmiar} height={rozmiar} className={`${wspolne} object-cover`} style={{ width: rozmiar, height: rozmiar }} />;
  }
  return (
    <span aria-hidden className={`${wspolne} inline-flex items-center justify-center bg-szary-300 font-semibold text-foodie-czern`} style={{ width: rozmiar, height: rozmiar, fontSize: Math.round(rozmiar * 0.45) }}>
      {inicjal(strona.nazwaStrony)}
    </span>
  );
}

import type { CSSProperties } from "react";
import { copy } from "@/lib/copy";
import { proporcjaPliku, stylProporcji } from "@/components/podglad/typy";
import type { PlikDto } from "@/lib/dto/materialy";

/**
 * Grafika albo wideo w zadanej proporcji. Zwykły <img> z wymiarami przez signed URL z własnej trasy
 * (decyzja D3, bez next/image). Wideo domyślnie wyciszone, z kontrolką, plakat z miniatury.
 */
export function Media({ plik, proporcja, dopasowanie = "przytnij", className = "", style, zaokraglenie = "" }: { plik: PlikDto | null; proporcja?: number; dopasowanie?: "przytnij" | "zawartosc"; className?: string; style?: CSSProperties; zaokraglenie?: string }) {
  const ratio = proporcja ?? proporcjaPliku(plik);
  const dopasowanieKlasa = dopasowanie === "przytnij" ? "object-cover" : "object-contain";
  return (
    <div className={`relative w-full overflow-hidden bg-szary-100 ${zaokraglenie} ${className}`} style={{ ...stylProporcji(ratio), ...style }}>
      {!plik ? null : plik.rodzaj === "wideo" ? (
        <video data-media src={plik.previewUrl} poster={plik.thumbUrl} muted playsInline controls preload="metadata" className={`absolute inset-0 h-full w-full ${dopasowanieKlasa}`} title={copy.podglad.wideoWyciszone} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- materiały klienta przez signed URL (decyzja D3)
        <img data-media src={plik.previewUrl} alt={plik.nazwa ?? ""} width={plik.szerokosc ?? undefined} height={plik.wysokosc ?? undefined} loading="lazy" decoding="async" className={`absolute inset-0 h-full w-full ${dopasowanieKlasa}`} />
      )}
    </div>
  );
}

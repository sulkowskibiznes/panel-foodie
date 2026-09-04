import { copy } from "@/lib/copy";
import type { PakietSzczegoly } from "@/lib/dto/materialy";
import { formatujDateCzas } from "@/lib/format";

function Baner({ ton, children, nazwa }: { ton: "zielony" | "bursztyn" | "szary" | "fiolet"; children: React.ReactNode; nazwa: string }) {
  const klasy = { zielony: "bg-green-50 text-zielony", bursztyn: "bg-amber-50 text-bursztyn", szary: "bg-szary-100 text-szary-600", fiolet: "bg-fiolet-050 text-fiolet-700" }[ton];
  return (
    <p role="status" data-baner={nazwa} className={`rounded-xl px-4 py-3 text-sm leading-6 ${klasy}`}>
      {children}
    </p>
  );
}

/** Banery stanu pakietu (SPEC rozdz. 6.3, 6.5, 6.6; 1.4 poz. 31: cofnięcie musi dotrzeć do klienta). */
export function BaneryPakietu({ pakiet }: { pakiet: PakietSzczegoly }) {
  const b = copy.pakiet.banery;
  const banery: React.ReactNode[] = [];
  if (pakiet.status === "poprawki") {
    banery.push(
      pakiet.cofniecie ? (
        <Baner key="cofniecie" ton="bursztyn" nazwa="cofniecie">
          {b.cofniecie.replace("{data}", formatujDateCzas(pakiet.cofniecie.kiedyO)).replace("{powod}", pakiet.cofniecie.powod)}
        </Baner>
      ) : (
        <Baner key="poprawki" ton="bursztyn" nazwa="poprawki">
          {b.poprawki}
        </Baner>
      ),
    );
  }
  if (pakiet.status === "zaakceptowany" || pakiet.status === "zaplanowany") {
    const data = pakiet.zaakceptowanoO ? formatujDateCzas(pakiet.zaakceptowanoO) : "";
    banery.push(
      <Baner key="zaakceptowano" ton="zielony" nazwa={pakiet.rodzajAkceptacji === "automatyczna" ? "zaakceptowano-auto" : "zaakceptowano"}>
        {pakiet.rodzajAkceptacji === "automatyczna" ? b.zaakceptowanoAuto.replace("{data}", data) : `${b.zaakceptowano.replace("{data}", data).replace("{osoba}", pakiet.zaakceptowal ?? copy.zespol.pakietyMaterialow.nikt)} ${b.komentowanieWlaczone}`}
      </Baner>,
    );
    if (pakiet.zmienionePoAkceptacji) {
      banery.push(
        <Baner key="podmiana" ton="bursztyn" nazwa="podmiana">
          {b.podmiana}
        </Baner>,
      );
    }
    if (pakiet.status === "zaplanowany") {
      banery.push(
        <Baner key="zaplanowano" ton="szary" nazwa="zaplanowano">
          {b.zaplanowano}
        </Baner>,
      );
    }
  }
  if (pakiet.status === "szkic") {
    banery.push(
      <Baner key="szkic" ton="szary" nazwa="szkic">
        {b.szkic}
      </Baner>,
    );
  }
  if (banery.length === 0) return null;
  return <div className="space-y-2">{banery}</div>;
}

/**
 * Nazwy zdarzeń z SPEC rozdz. 15 (jeden generyczny webhook do Zapiera). Czysty plik bez zależności
 * serwerowych, żeby maszyna stanów i jej testy mogły z niego korzystać.
 */
export const ZDARZENIA_OUTBOX = [
  "pakiet.wyslany",
  "pakiet.otwarty",
  "pakiet.zaakceptowany",
  "pakiet.zaakceptowany_auto",
  "pakiet.poprawki",
  "pakiet.nieotwarty_po_24h",
  "pakiet.auto_za_24h",
  "pakiet.auto_wstrzymana_uwagi",
  "pakiet.wycofany",
  "pakiet.cofniety_do_poprawek",
  "komentarz.po_akceptacji",
  "material.podmieniony_po_akceptacji",
  "usluga.zainteresowanie",
  "bezpieczenstwo.blokada",
] as const;

export type ZdarzenieOutbox = (typeof ZDARZENIA_OUTBOX)[number];

import type { Metadata } from "next";
import { DokumentPrawny } from "@/components/uklad/dokument-prawny";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.prywatnosc.tytul };

export default function PolitykaPrywatnosci() {
  return <DokumentPrawny {...copy.prywatnosc} />;
}

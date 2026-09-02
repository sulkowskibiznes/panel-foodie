import type { Metadata } from "next";
import { DokumentPrawny } from "@/components/uklad/dokument-prawny";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.regulamin.tytul };

export default function Regulamin() {
  return <DokumentPrawny {...copy.regulamin} />;
}

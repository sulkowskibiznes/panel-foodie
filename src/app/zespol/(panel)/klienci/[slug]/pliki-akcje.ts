"use server";

import { notFound } from "next/navigation";
import { z } from "zod";
import { assertTeamClientAccess, wymagajCzlonka, wymagajUprawnienia, type CzlonekZespolu } from "@/lib/auth-zespol";
import { pobierzKlientaPoSlugu, type KartaKlienta } from "@/lib/dane/klienci-zespolu";
import { czyBucketPdf, przygotujUploadPdf, zakonczUploadPdf, type BucketPdf, type WynikPrzygotowaniaPdf, type WynikZakonczeniaPdf } from "@/lib/pliki/pdf";

/**
 * Upload PDF dla faktur i dokumentów (lib/pliki/pdf.ts): bucket przesądza o wymaganym uprawnieniu.
 * Wynikiem jest podpisany opis pliku; mutacja faktury albo dokumentu przyjmuje wyłącznie ten opis.
 */
export async function autoryzujPdf(slug: string, bucket: string): Promise<{ czlonek: CzlonekZespolu; klient: KartaKlienta; bucket: BucketPdf }> {
  if (!czyBucketPdf(bucket)) notFound();
  const czlonek = await wymagajCzlonka();
  wymagajUprawnienia(czlonek, bucket, "pelne");
  const klient = await pobierzKlientaPoSlugu(slug);
  if (!klient) notFound();
  await assertTeamClientAccess(czlonek, klient.id);
  return { czlonek, klient, bucket };
}

const schematPliku = z.object({ nazwa: z.string().max(300), mime: z.string().max(100), bytes: z.number().int().positive() });

export async function przygotujPdf(slug: string, bucket: string, plik: z.input<typeof schematPliku>): Promise<WynikPrzygotowaniaPdf> {
  const k = await autoryzujPdf(slug, bucket);
  const parsed = schematPliku.safeParse(plik);
  if (!parsed.success) return { ok: false, powod: "nieobslugiwany" };
  return przygotujUploadPdf(k.bucket, k.klient.id, parsed.data);
}

export async function zakonczPdf(slug: string, bucket: string, pozwolenie: string): Promise<WynikZakonczeniaPdf> {
  const k = await autoryzujPdf(slug, bucket);
  return zakonczUploadPdf(k.bucket, k.klient.id, String(pozwolenie ?? ""));
}

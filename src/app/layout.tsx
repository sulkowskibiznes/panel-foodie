import type { Metadata, Viewport } from "next";
import "./globals.css";
import { copy } from "@/lib/copy";

const adresAplikacji = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** SPEC rozdz. 4.3 i 16.10: noindex wszędzie, neutralny podgląd linku bez nazwy lokalu i liczb. */
export const metadata: Metadata = {
  metadataBase: new URL(adresAplikacji),
  title: { default: copy.marka.panel, template: `%s - ${copy.marka.nazwa}` },
  description: copy.marka.opisOg,
  applicationName: copy.marka.panel,
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: { index: false, follow: false, noarchive: true },
  },
  openGraph: {
    title: copy.marka.panel,
    description: copy.marka.opisOg,
    siteName: copy.marka.nazwa,
    locale: "pl_PL",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7600F4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-foodie-czern">{children}</body>
    </html>
  );
}

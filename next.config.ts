import type { NextConfig } from "next";

// Nagłówki bezpieczeństwa z SPEC rozdz. 16.6 i 16.10. Pełne CSP z nonce dochodzi w fazie 6.
const naglowkiBezpieczenstwa = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Wskaźnik trybu deweloperskiego psułby wzorce zrzutów Playwrighta (webServer = pnpm dev).
  devIndicators: false,
  async headers() {
    return [{ source: "/(.*)", headers: naglowkiBezpieczenstwa }];
  },
};

export default nextConfig;

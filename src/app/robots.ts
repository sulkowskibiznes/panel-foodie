import type { MetadataRoute } from "next";

/** SPEC rozdz. 16.10: panel klienta i zespołu poza indeksem. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/p/", "/zespol/", "/api/"] }],
  };
}

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: "https://sudoklash.galletguemeric.chatgpt.site/sitemap.xml",
    host: "https://sudoklash.galletguemeric.chatgpt.site",
  };
}

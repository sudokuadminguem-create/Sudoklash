import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://sudoklash.galletguemeric.chatgpt.site",
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}

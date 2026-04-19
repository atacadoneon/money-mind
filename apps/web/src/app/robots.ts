import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://moneymind.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/precos", "/sobre", "/contato", "/termos", "/privacidade", "/cookies", "/seguranca", "/sla", "/dpa", "/dpo", "/help"],
        disallow: ["/api/", "/(app)/", "/(auth)/", "/onboarding/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}

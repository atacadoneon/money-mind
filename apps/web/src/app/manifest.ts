import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Money Mind — BPO Financeiro",
    short_name: "Money Mind",
    description: "Sistema BPO Financeiro com conciliação inteligente",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#3b82f6",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ],
    categories: ["finance", "productivity", "business"],
    lang: "pt-BR"
  };
}

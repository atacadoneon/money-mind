import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/health",
  // Marketing
  "/precos",
  "/sobre",
  "/contato",
  "/landing",
  // Legal
  "/termos",
  "/privacidade",
  "/cookies",
  "/seguranca",
  "/sla",
  "/dpa",
  "/dpo",
  // Help & Status
  "/help",
  "/status",
];

// Paths that are public AND should NOT redirect to login
const FULLY_PUBLIC = ["/termos", "/privacidade", "/cookies", "/seguranca", "/sla", "/dpa", "/dpo", "/help", "/status", "/landing", "/precos", "/sobre", "/contato"];
const ONBOARDING_PATH = "/onboarding"; // outside (app) group — clean layout

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV === "development";

  if (FULLY_PUBLIC.some((p) => pathname.startsWith(p))) return res;
  if (pathname === "/") return res;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return res;

  if (!isSupabaseConfigured()) {
    if (isDev) {
      return res;
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "misconfigured", detail: "Supabase env missing" }, { status: 503 });
    }
    return new NextResponse("Configuração inválida: variáveis Supabase ausentes no servidor.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && !isDev) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "auth");
      return NextResponse.redirect(url);
    }
    if (!data.user && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    if (data.user && !pathname.startsWith(ONBOARDING_PATH)) {
      try {
        const { data: orgData, error: orgErr } = await supabase
          .from("organizations")
          .select("settings")
          .eq("owner_id", data.user.id)
          .maybeSingle();
        if (orgErr && isDev) {
          /* tabela/schema em dev — ignorar */
        } else if (orgErr && !isDev) {
          const url = req.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("error", "org");
          return NextResponse.redirect(url);
        } else if (!orgErr) {
          const settings = (orgData?.settings ?? {}) as Record<string, unknown>;
          if (settings.onboarded !== true && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
            const url = req.nextUrl.clone();
            url.pathname = ONBOARDING_PATH;
            return NextResponse.redirect(url);
          }
        }
      } catch {
        if (!isDev) {
          const url = req.nextUrl.clone();
          url.pathname = "/login";
          url.searchParams.set("error", "session");
          return NextResponse.redirect(url);
        }
      }
    }
  } catch {
    if (!isDev) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "session");
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|woff2)$).*)"],
};

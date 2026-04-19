const withBundleAnalyzer = (() => {
  try {
    return require("@next/bundle-analyzer")({
      enabled: process.env.ANALYZE === "true"
    });
  } catch {
    return (c) => c;
  }
})();

const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@money-mind/shared-types", "@money-mind/utils"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    instrumentationHook: true
  },
  async rewrites() {
    return [];
  },

  // ─── Security Headers ──────────────────────────────────────────────────────
  async headers() {
    const securityHeaders = [
      // Prevent clickjacking
      { key: "X-Frame-Options", value: "DENY" },
      // Prevent MIME type sniffing
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Referrer policy
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Permissions policy — restrict powerful APIs
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()"
      },
      // DNS prefetch control
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];

    // HSTS only in production (avoid breaking localhost dev)
    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload"
      });
    }

    const apiOrigin = (() => {
      const u = process.env.NEXT_PUBLIC_API_URL;
      if (!u) return "";
      try {
        return new URL(u).origin;
      } catch {
        return "";
      }
    })();

    // Content Security Policy — restrictive in prod, loose in dev
    const connectSrc = [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://sentry.io",
      "https://*.sentry.io",
    ];
    if (apiOrigin) connectSrc.push(apiOrigin);

    const cspHeader = isProd
      ? [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self'",
          `connect-src ${connectSrc.join(" ")}`,
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "object-src 'none'",
          "upgrade-insecure-requests",
        ].join("; ")
      : ""; // No CSP in dev (too restrictive for HMR/devtools)

    if (cspHeader) {
      securityHeaders.push({ key: "Content-Security-Policy", value: cspHeader });
    }

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// Wrap with Sentry only when the package is available
let config = nextConfig;
try {
  const { withSentryConfig } = require("@sentry/nextjs");
  config = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true
  });
} catch {
  // @sentry/nextjs not installed — skip
}

module.exports = withBundleAnalyzer(config);

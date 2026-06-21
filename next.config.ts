import type { NextConfig } from "next";

// Next.js does not add security headers by default. These apply to every route.
// NOTE: script-src includes 'unsafe-inline' because Next.js App Router injects
// inline scripts for RSC payload and hydration. Nonce-based strict CSP is the
// proper long-term fix (see Next.js CSP docs) but requires more infrastructure.
//
// 'unsafe-eval' is added in DEVELOPMENT ONLY: React's dev build uses eval() for
// debugging features (e.g. reconstructing call stacks), so a CSP without it makes
// strict browsers (notably Firefox) block React's dev runtime — the client never
// hydrates and onClick/useState silently do nothing (native <form> POSTs still
// work, which masks it). React never uses eval() in production, so the production
// CSP omits 'unsafe-eval' and stays strict.
const isDev = process.env.NODE_ENV !== "production";

const scriptSrc = ["'self'", "'unsafe-inline'", isDev ? "'unsafe-eval'" : null]
  .filter(Boolean)
  .join(" ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

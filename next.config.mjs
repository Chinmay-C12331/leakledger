/** @type {import('next').NextConfig} */
const config = {
  devIndicators: false,
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/**/*": ["./demo/school-gate-staged.jpg"] },
  async headers() {
    return [
      { source: "/:path*", headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/track/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};
export default config;

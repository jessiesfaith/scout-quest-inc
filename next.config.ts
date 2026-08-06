import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These routes read files from the repo at request time — make sure
  // Vercel's serverless bundles include them.
  outputFileTracingIncludes: {
    "/": ["./index.html"],
    "/hr/constitution": ["./docs/enterprise-constitution-v1.4.md"],
  },

  experimental: {
    // Contract uploads run through a Server Action; the default 1 MB body
    // cap would reject files the 10 MB UI limit accepts.
    serverActions: { bodySizeLimit: "12mb" },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Framing the sign-in page enables clickjacking; nothing here is
          // meant to be embedded.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

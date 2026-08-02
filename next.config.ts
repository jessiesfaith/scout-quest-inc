import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The "/" route handler serves index.html from the repo root at request
  // time — make sure Vercel's serverless bundle includes the file.
  outputFileTracingIncludes: {
    "/": ["./index.html"],
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the dev server to be opened through the cloudflared tunnel URL
  // (needed to test on a phone from another network).
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;

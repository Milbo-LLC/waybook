/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@waybook/contracts", "@waybook/ui"],
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;

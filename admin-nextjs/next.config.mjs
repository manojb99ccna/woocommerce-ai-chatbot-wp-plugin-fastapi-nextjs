/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/admin",
  env: {
    NEXT_PUBLIC_BASE_PATH: "/admin"
  },
  reactCompiler: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;

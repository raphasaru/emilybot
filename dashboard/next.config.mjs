/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@napi-rs/canvas', 'sharp', 'archiver'],
};

export default nextConfig;

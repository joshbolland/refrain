/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@refrain/domain',
    '@refrain/editor-core',
    '@refrain/design-tokens',
    '@refrain/supabase-client',
  ],
};

module.exports = nextConfig;

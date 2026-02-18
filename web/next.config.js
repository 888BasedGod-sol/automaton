/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AUTOMATON_API: process.env.AUTOMATON_API_URL || 'http://localhost:8888',
  },
}

module.exports = nextConfig

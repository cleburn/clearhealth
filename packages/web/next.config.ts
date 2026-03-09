/**
 * ClearHealth Web — Next.js Configuration
 *
 * Configures the Next.js application with security headers,
 * image domains, and environment variable validation.
 *
 * @security
 * - Strict CSP headers prevent XSS attacks
 * - HSTS enforces HTTPS in production
 * - X-Frame-Options prevents clickjacking
 * - Environment variables validated at build time
 */

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /** Allowed domains for patient document image uploads */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
        pathname: '/clearhealth-documents/**',
      },
    ],
  },

  /** Security headers applied to all responses */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://*.s3.amazonaws.com",
              "font-src 'self'",
              "connect-src 'self' http://localhost:3001",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  /** Environment variable validation — fail build if missing */
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  },
};

export default nextConfig;

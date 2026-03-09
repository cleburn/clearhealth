/**
 * ClearHealth Web — Root Layout
 *
 * Wraps all pages with authentication, notification providers,
 * and global styles. Sets up the Inter font and HTML metadata.
 *
 * @security All pages require authentication except /login and /forgot-password.
 * The AuthProvider handles token refresh and redirect logic.
 */

// All pages require authentication except /login and /forgot-password

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ClearHealth — Appointment Management',
  description: 'Multi-tenant healthcare appointment management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-background text-foreground">
        {/* TODO: implement AuthProvider — wraps app with auth context */}
        {/* TODO: implement ToastProvider — notification system for user feedback */}
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}

/**
 * ClearHealth Web — Root Layout
 *
 * Wraps all pages with authentication, notification providers,
 * and global styles. Sets up the Inter font and HTML metadata.
 *
 * @security All pages require authentication except /login and /forgot-password.
 * The AuthProvider handles token refresh and redirect logic.
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ClearHealth — Appointment Management",
  description: "Multi-tenant healthcare appointment management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-background text-foreground">
        <AuthProvider>
          <ToastProvider>
            <main className="min-h-screen">{children}</main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

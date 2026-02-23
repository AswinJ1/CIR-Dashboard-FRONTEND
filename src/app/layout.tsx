import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-context";
import { ThemedProvider } from "@/components/providers/themed-provider";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CIR Work Management System",
  description: "CIR Work & Responsibility Management System - Manage work assignments, submissions, and verifications",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ThemedProvider>
            {children}
            <Toaster position="top-right" richColors />
          </ThemedProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

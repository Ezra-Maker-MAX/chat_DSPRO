import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Chatmosphere — anonymous spaces that matter",
  description: "Multi-tenant anonymous chat rooms. Join with an invite code.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[var(--color-bg-deep)] text-[var(--color-text-primary)]">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

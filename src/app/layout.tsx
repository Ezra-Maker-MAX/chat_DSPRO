import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}

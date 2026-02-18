import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinkedIn Digital Twin | Geodo AI Agent",
  description:
    "AI-powered LinkedIn outreach automation. Send messages, read conversations, and manage your LinkedIn presence with plain English commands.",
  keywords: [
    "LinkedIn",
    "AI Agent",
    "Automation",
    "Digital Twin",
    "Geodo",
    "OpenClaw",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

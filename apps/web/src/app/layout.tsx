import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waybook",
  description: "Capture once. Keep forever. Share effortlessly. Recreate instantly."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

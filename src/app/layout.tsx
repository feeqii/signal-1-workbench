import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Signal 1 · KRAS investigation",
  description:
    "A structure-centred investigation of KRAS binding and abundance, with linked experimental evidence, researcher findings, and reproducible experimental panels.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

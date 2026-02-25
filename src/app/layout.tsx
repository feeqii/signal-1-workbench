import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Signal-1 3D Workbench",
  description:
    "3D-first target triage platform with Mol*, Open Targets, UniProt, AlphaFold, RCSB, and ChEMBL"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

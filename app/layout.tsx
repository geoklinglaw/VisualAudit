import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuditProvider } from "../components/audit-context";

export const metadata: Metadata = {
  title: "VisualAudit",
  description: "See what image-based AI saw, inferred, and may be guessing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuditProvider>{children}</AuditProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "TeoClass — Gestão Acadêmica e EAD para Escolas Teológicas",
  description: "Plataforma integrada de gestão acadêmica, financeira e ensino a distância para seminários e instituições teológicas cristãs.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TeoClass",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900 flex flex-col">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Centinela Digital · Un espacio para ser escuchado",
  description:
    "Información, reportes confidenciales y orientación frente a situaciones de violencia.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Usage Audit",
  description: "Production-ready AI spend audit workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
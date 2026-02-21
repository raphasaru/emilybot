import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const dm = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EmilyBot — Conteudo no Piloto Automatico",
  description:
    "IA que pesquisa, escreve e cria imagens para suas redes sociais. Voce so aprova e publica.",
  openGraph: {
    title: "EmilyBot — Conteudo no Piloto Automatico",
    description: "IA que cria conteudo profissional para suas redes sociais.",
    type: "website",
    locale: "pt_BR",
    url: "https://emilybot.com.br",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body
        className={`${bricolage.variable} ${dm.variable} font-body antialiased bg-surface text-text`}
      >
        {children}
      </body>
    </html>
  );
}

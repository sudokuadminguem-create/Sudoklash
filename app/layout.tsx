import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./a11y.css";
import "./themes.css";
import "./menu-contrast.css";
import { displayScript } from "./lib/settings-model";
export const metadata: Metadata = {
  metadataBase: new URL("https://sudoklash.galletguemeric.chatgpt.site"),
  title: "Sudoku Clash (Sudoklash) — Sudoku gratuit en ligne",
  description:
    "Joue gratuitement et sans compte à Sudoku Clash, aussi appelé Sudoklash. Choisis ta difficulté en solo ou connecte-toi pour les défis et les duels classés.",
  keywords: [
    "Sudoku Clash",
    "Sudoklash",
    "sudoku en ligne",
    "grille sudoku",
    "sudoku quotidien",
    "défi sudoku",
  ],
  applicationName: "Sudoku Clash",
  creator: "Sudoku Clash",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Sudoku Clash (Sudoklash) — Sudoku gratuit en ligne",
    description: "Des grilles 9×9, des défis quotidiens et hebdomadaires et une arène compétitive.",
    siteName: "Sudoku Clash",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sudoku Clash (Sudoklash) — Sudoku gratuit en ligne",
    description: "Jouez au Sudoku en ligne et relevez les défis quotidiens et hebdomadaires.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sudoklash", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#070b16",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The display script sets data attributes on <html> before React looks at it.
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: displayScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

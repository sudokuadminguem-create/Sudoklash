import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://sudoklash.galletguemeric.chatgpt.site"),
  title: "Sudoku Clash — Le Sudoku compétitif",
  description:
    "Jouez au Sudoku en ligne sur des grilles 9×9, relevez les défis quotidiens et hebdomadaires et mesurez-vous aux autres joueurs.",
  keywords: ["Sudoku Clash", "sudoku en ligne", "grille sudoku", "sudoku quotidien", "défi sudoku"],
  applicationName: "Sudoku Clash",
  creator: "Sudoku Clash",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Sudoku Clash — Le Sudoku compétitif",
    description: "Des grilles 9×9, des défis quotidiens et hebdomadaires et une arène compétitive.",
    siteName: "Sudoku Clash",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sudoku Clash — Le Sudoku compétitif",
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
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

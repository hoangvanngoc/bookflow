import type { Metadata } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque } from "next/font/google";
import { Header } from "./header";
import { VerticalProvider } from "./providers";
import "./globals.css";

// Be Vietnam Pro has full Vietnamese diacritics, which the assistant examples need.
const body = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});
const display = Bricolage_Grotesque({
  subsets: ["latin", "vietnamese"],
  weight: ["700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Bookflow",
  description: "A small, config-driven booking app with an AI booking assistant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <VerticalProvider>
          <Header />
          <main className="main">{children}</main>
          <footer className="footer">
            Demo data lives in your browser only.{" "}
            <a href="https://github.com/hoangvanngoc/bookflow">Source on GitHub</a> ·{" "}
            <a href="https://bookapp.yeowubie.com/landing">Full product</a>
          </footer>
        </VerticalProvider>
      </body>
    </html>
  );
}

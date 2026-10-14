import type { Metadata } from "next";
import { Header } from "./header";
import { VerticalProvider } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bookflow",
  description: "A small, config-driven booking app for appointment-based service businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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

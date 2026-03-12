import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Instant Budget Check - Free Budget Calculator | 50/30/20 Rule",
  description:
    "Check your budget in seconds with our free instant budget calculator. See your cash flow, savings rate, debt-to-income ratio, and get personalized 50/30/20 recommendations.",
  keywords: [
    "budget calculator",
    "instant budget check",
    "50 30 20 calculator",
    "how much should I save",
    "free budget tool",
    "savings rate calculator",
    "debt to income ratio",
    "cash flow calculator",
  ],
  openGraph: {
    title: "Instant Budget Check - Free Budget Calculator",
    description:
      "See your cash flow, savings rate, and personalized recommendations in seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="header-inner">
            <a href="/" className="logo">
              <span className="logo-icon">$</span>
              <span className="logo-text">Instant Budget Check</span>
            </a>
            <span className="header-tag">100% Free &middot; No Sign-up</span>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <p>
            &copy; {new Date().getFullYear()} Instant Budget Check. All
            calculations happen in your browser. We never see or store your
            data.
          </p>
        </footer>
      </body>
    </html>
  );
}

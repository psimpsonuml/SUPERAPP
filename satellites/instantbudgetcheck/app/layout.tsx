import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://instantbudgetcheck.com"),
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
    locale: "en_US",
    url: "https://instantbudgetcheck.com",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Instant Budget Check - Free Budget Calculator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Instant Budget Check - Free Budget Calculator",
    description:
      "See your cash flow, savings rate, and personalized recommendations in seconds.",
    images: ["/og-default.png"],
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BeaconOps",
  url: "https://instantbudgetcheck.com",
  logo: "https://instantbudgetcheck.com/og-default.png",
};

const jsonLdWebApplication = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Instant Budget Check",
  url: "https://instantbudgetcheck.com",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const jsonLdHowTo = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Check Your Budget with the 50/30/20 Rule",
  step: [
    {
      "@type": "HowToStep",
      text: "Enter your monthly after-tax income",
    },
    {
      "@type": "HowToStep",
      text: "Add your monthly expenses in needs (housing, utilities, groceries, insurance) and wants (dining, entertainment, subscriptions)",
    },
    {
      "@type": "HowToStep",
      text: "Add any debt payments (credit cards, student loans, car payments)",
    },
    {
      "@type": "HowToStep",
      text: "Review your budget breakdown showing your 50/30/20 allocation, savings rate, and debt-to-income ratio",
    },
  ],
};

const jsonLdFAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the 50/30/20 budget rule?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The 50/30/20 rule is a budgeting guideline that allocates 50% of after-tax income to needs (housing, utilities, groceries), 30% to wants (dining, entertainment, subscriptions), and 20% to savings and debt repayment.",
      },
    },
    {
      "@type": "Question",
      name: "Is the Instant Budget Check free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, our budget calculator is completely free and runs entirely in your browser. No data is sent to any server \u2014 your financial information stays private.",
      },
    },
    {
      "@type": "Question",
      name: "What is a good savings rate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Financial experts recommend saving at least 20% of your after-tax income. A savings rate above 20% is excellent, 10-20% is good, and below 10% suggests you should look for ways to reduce expenses.",
      },
    },
    {
      "@type": "Question",
      name: "What is debt-to-income ratio?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Debt-to-income (DTI) ratio is the percentage of your monthly income that goes toward debt payments. A DTI below 20% is healthy, 20-35% is manageable, and above 35% may indicate financial stress.",
      },
    },
    {
      "@type": "Question",
      name: "How accurate is this budget calculator?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The calculator provides an accurate breakdown based on the numbers you enter. It uses the widely-accepted 50/30/20 framework. For comprehensive financial planning, consider consulting a financial advisor.",
      },
    },
  ],
};

const jsonLdBreadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://instantbudgetcheck.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Budget Calculator",
      item: "https://instantbudgetcheck.com",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdOrganization),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdWebApplication),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdHowTo),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdFAQ),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLdBreadcrumb),
          }}
        />
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

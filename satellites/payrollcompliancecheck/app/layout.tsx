import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://payrollcompliancecheck.com"),
  title: "Payroll Compliance Check — Free Multi-State Payroll Compliance Tool",
  description:
    "Free state payroll compliance check tool. Verify multi-state payroll requirements, payroll tax by state, filing deadlines, minimum wage, and overtime rules across all 50 US states.",
  keywords: [
    "state payroll compliance check",
    "multi-state payroll requirements",
    "payroll tax by state",
    "payroll compliance tool",
    "state tax filing requirements",
    "minimum wage by state",
    "new hire reporting",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Payroll Compliance Check — Free Multi-State Payroll Compliance Tool",
    description:
      "Free state payroll compliance check tool. Verify multi-state payroll requirements, payroll tax by state, filing deadlines, minimum wage, and overtime rules across all 50 US states.",
    siteName: "Payroll Compliance Check",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Payroll Compliance Check — Free Multi-State Payroll Compliance Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Payroll Compliance Check — Free Multi-State Payroll Compliance Tool",
    description:
      "Free state payroll compliance check tool. Verify multi-state payroll requirements, payroll tax by state, filing deadlines, minimum wage, and overtime rules across all 50 US states.",
    images: ["/og-default.png"],
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

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BeaconOps",
  url: "https://payrollcompliancecheck.com",
  logo: "https://payrollcompliancecheck.com/og-default.png",
};

const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Payroll Compliance Check",
  url: "https://payrollcompliancecheck.com",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a payroll compliance check?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A payroll compliance check verifies that your business meets all federal and state payroll requirements, including tax withholding rates, minimum wage laws, pay frequency rules, and overtime regulations.",
      },
    },
    {
      "@type": "Question",
      name: "Is this payroll compliance tool free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, our multi-state payroll compliance checker is completely free. Check compliance requirements for all 50 US states instantly.",
      },
    },
    {
      "@type": "Question",
      name: "What does a state payroll compliance report include?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Each state report covers state income tax rates, minimum wage, pay frequency requirements, overtime rules, new hire reporting deadlines, and key compliance notes specific to that state.",
      },
    },
    {
      "@type": "Question",
      name: "How often do payroll compliance requirements change?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Payroll regulations can change annually or even mid-year. State minimum wages, tax rates, and reporting requirements are updated regularly. We keep our data current to reflect the latest requirements.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need a payroll compliance check for each state?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, if you have employees in multiple states, each state has its own payroll tax rates, minimum wage, overtime rules, and reporting requirements. Our tool lets you check all 50 states.",
      },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://payrollcompliancecheck.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Payroll Compliance Check",
      item: "https://payrollcompliancecheck.com",
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
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webApplicationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbSchema),
          }}
        />
        <header className="site-header">
          <div className="inner">
            <a href="/" className="logo">
              <span className="logo-icon">PC</span>
              Payroll Compliance Check
            </a>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          &copy; {new Date().getFullYear()} Payroll Compliance Check. For
          informational purposes only&mdash;consult a qualified professional for
          tax advice.
        </footer>
      </body>
    </html>
  );
}

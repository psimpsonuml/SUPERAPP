import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://althistoryquiz.com'),
  title: 'Alt History Quiz — What Kind of History Maker Are You?',
  description:
    'Take our alternate history personality quiz! Answer fun "what if" questions about history and discover whether you\'re a Timeline Divergent, History Preserver, Chaos Agent, or Future Architect. The ultimate history personality quiz.',
  keywords: [
    'alternate history quiz',
    'what if history quiz',
    'history personality quiz',
    'alternate history personality test',
    'history what if questions',
    'fun history quiz',
    'alt history quiz',
  ],
  openGraph: {
    title: 'Alt History Quiz — What Kind of History Maker Are You?',
    description:
      'Answer fun alternate history questions and discover your history-maker personality type.',
    type: 'website',
    locale: 'en_US',
    url: 'https://althistoryquiz.com',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'Alt History Quiz — What Kind of History Maker Are You?',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Alt History Quiz — What Kind of History Maker Are You?',
    description:
      'Answer fun alternate history questions and discover your history-maker personality type.',
    images: ['/og-default.png'],
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLdOrganization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'BeaconOps',
  url: 'https://althistoryquiz.com',
};

const jsonLdWebApplication = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Alt History Quiz',
  url: 'https://althistoryquiz.com',
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  publisher: {
    '@type': 'Organization',
    name: 'BeaconOps',
  },
};

const jsonLdQuiz = {
  '@context': 'https://schema.org',
  '@type': 'Quiz',
  name: 'What Kind of History Maker Are You?',
  description:
    'Explore alternate history scenarios and discover your history personality type',
  about: {
    '@type': 'Thing',
    name: 'Alternate History',
  },
  provider: {
    '@type': 'Organization',
    name: 'BeaconOps',
  },
};

const jsonLdFAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the Alt History Quiz?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The Alt History Quiz is a free personality quiz that presents you with alternate history scenarios — \'what if\' questions about pivotal moments in history — and determines your history maker personality type based on your choices.',
      },
    },
    {
      '@type': 'Question',
      name: 'What are the personality types?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'There are four personality types: Timeline Divergent (embraces radical change), History Preserver (values stability and continuity), Chaos Agent (thrives on unpredictable outcomes), and Future Architect (focuses on long-term technological and social progress).',
      },
    },
    {
      '@type': 'Question',
      name: 'How many questions are in the quiz?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Each quiz session presents 12 questions randomly selected from a pool of over 50 alternate history scenarios, so you get a different experience each time you take it.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the Alt History Quiz free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, the quiz is completely free to take. You can retake it as many times as you like to explore different scenarios and potentially get a different personality result.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I share my quiz results?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! After completing the quiz, you can copy your results to share with friends on social media or messaging apps.',
      },
    },
  ],
};

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://althistoryquiz.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Alt History Quiz',
      item: 'https://althistoryquiz.com',
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
            __html: JSON.stringify(jsonLdQuiz),
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
          <div className="container">
            <div className="header-logo">
              Alt History Quiz <span>— What If?</span>
            </div>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          <div className="container">
            A fun quiz by ChronoStates &middot; Explore alternate timelines
          </div>
        </footer>
      </body>
    </html>
  );
}

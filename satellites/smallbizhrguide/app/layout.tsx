import type { Metadata } from 'next';
import { BLOG_CONFIG } from '../config';
import JsonLd from './components/JsonLd';
import './globals.css';

const siteUrl = `https://${BLOG_CONFIG.domain}`;

export const metadata: Metadata = {
  title: {
    default: `${BLOG_CONFIG.name} — ${BLOG_CONFIG.tagline}`,
    template: `%s | ${BLOG_CONFIG.name}`,
  },
  description: BLOG_CONFIG.tagline,
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
    types: {
      'application/rss+xml': [{ url: '/feed.xml', title: `${BLOG_CONFIG.name} RSS Feed` }],
    },
  },
  openGraph: {
    type: 'website',
    locale: BLOG_CONFIG.language.replace('-', '_'),
    url: siteUrl,
    siteName: BLOG_CONFIG.name,
    title: BLOG_CONFIG.name,
    description: BLOG_CONFIG.tagline,
    images: [{ url: BLOG_CONFIG.defaultOgImage, width: 1200, height: 630, alt: BLOG_CONFIG.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: BLOG_CONFIG.name,
    description: BLOG_CONFIG.tagline,
    ...(BLOG_CONFIG.twitterHandle ? { creator: BLOG_CONFIG.twitterHandle } : {}),
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BLOG_CONFIG.publisher,
    url: BLOG_CONFIG.publisherUrl,
    logo: BLOG_CONFIG.publisherLogo,
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BLOG_CONFIG.name,
    url: siteUrl,
    description: BLOG_CONFIG.tagline,
    inLanguage: BLOG_CONFIG.language,
    publisher: {
      '@type': 'Organization',
      name: BLOG_CONFIG.publisher,
      url: BLOG_CONFIG.publisherUrl,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang={BLOG_CONFIG.language.split('-')[0]}>
      <head>
        <JsonLd data={[organizationSchema, websiteSchema]} />
        {BLOG_CONFIG.googleAnalyticsId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${BLOG_CONFIG.googleAnalyticsId}`} />
            <script dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${BLOG_CONFIG.googleAnalyticsId}');`
            }} />
          </>
        )}
        {BLOG_CONFIG.plausibleDomain && (
          <script defer data-domain={BLOG_CONFIG.plausibleDomain} src="https://plausible.io/js/script.js" />
        )}
        <style dangerouslySetInnerHTML={{
          __html: `:root { --accent: ${BLOG_CONFIG.accentColor}; --accent-light: ${BLOG_CONFIG.accentColorLight}; }`
        }} />
      </head>
      <body>
        <header className="header">
          <div className="header-inner">
            <a href="/" className="logo">
              <span className="logo-emoji">{BLOG_CONFIG.logoEmoji}</span>
              <span className="logo-text">{BLOG_CONFIG.name}</span>
            </a>
            <nav className="nav">
              <a href="/">Home</a>
              <a href="/about">About</a>
            </nav>
          </div>
        </header>
        <main className="main">{children}</main>
        <footer className="footer">
          <div className="footer-inner">
            <p>&copy; {new Date().getFullYear()} {BLOG_CONFIG.name}. All rights reserved.</p>
            <p style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>
              A {BLOG_CONFIG.publisher} publication
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

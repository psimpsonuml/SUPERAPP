import type { Metadata } from 'next';
import { BLOG_CONFIG } from '../config';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${BLOG_CONFIG.name} — ${BLOG_CONFIG.tagline}`,
    template: `%s | ${BLOG_CONFIG.name}`,
  },
  description: BLOG_CONFIG.tagline,
  metadataBase: new URL(`https://${BLOG_CONFIG.domain}`),
  openGraph: {
    type: 'website',
    siteName: BLOG_CONFIG.name,
    title: BLOG_CONFIG.name,
    description: BLOG_CONFIG.tagline,
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
          </div>
        </footer>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
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

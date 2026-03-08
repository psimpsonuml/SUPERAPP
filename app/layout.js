import './globals.css';

export const metadata = {
  title: 'BeaconOps Dashboard',
  description: 'Approval dashboard for BeaconOps autonomous marketing engine',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav-brand">BeaconOps</div>
          <div className="nav-links">
            <a href="/">Approvals</a>
            <a href="/settings">Settings</a>
            <a href="/reports">Reports</a>
          </div>
        </nav>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}

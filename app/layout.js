import './globals.css';
import Sidebar from './components/Sidebar';

export const metadata = {
  title: 'BeaconOps Dashboard',
  description: 'Control center for BeaconOps autonomous marketing engine',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

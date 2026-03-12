import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
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

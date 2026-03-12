"use client";

import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  All 50 states + DC                                                 */
/* ------------------------------------------------------------------ */
const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL",
  "GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI",
  "SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",
  FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",
  IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",
  OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",
  WY:"Wyoming",
};

/* ------------------------------------------------------------------ */
/*  Hardcoded compliance data for 15 representative states             */
/* ------------------------------------------------------------------ */
interface StateData {
  taxRate: string;
  filingFrequency: string;
  newHireDeadline: string;
  minimumWage: string;
  overtimeRules: string;
  recentChanges: string;
  risk: "low" | "medium" | "high";
}

const COMPLIANCE_DATA: Record<string, StateData> = {
  CA: {
    taxRate: "1.0% – 13.3% (progressive, 10 brackets)",
    filingFrequency: "Quarterly (DE 9 / DE 9C)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$16.00/hr (statewide); some cities higher",
    overtimeRules: "Daily OT after 8 hrs; double-time after 12 hrs",
    recentChanges: "Minimum wage increased to $16.00 effective Jan 2024. Fast-food workers $20/hr as of Apr 2024. New pay transparency requirements for job postings.",
    risk: "high",
  },
  TX: {
    taxRate: "No state income tax",
    filingFrequency: "Quarterly (C-3/C-4)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$7.25/hr (federal minimum)",
    overtimeRules: "Federal FLSA rules (1.5x after 40 hrs/week)",
    recentChanges: "No recent major changes. Texas continues to have no state income tax. TWC unemployment tax rates updated annually.",
    risk: "low",
  },
  FL: {
    taxRate: "No state income tax",
    filingFrequency: "Quarterly (RT-6)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$13.00/hr (increases $1/yr through 2026)",
    overtimeRules: "Federal FLSA rules (1.5x after 40 hrs/week)",
    recentChanges: "Minimum wage rose to $13.00/hr in Sept 2024, on track for $15.00/hr by 2026. E-Verify required for employers with 25+ employees.",
    risk: "low",
  },
  NY: {
    taxRate: "4.0% – 10.9% (progressive, 9 brackets)",
    filingFrequency: "Quarterly (NYS-45)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$15.00/hr upstate; $16.00/hr NYC, Westchester, Long Island",
    overtimeRules: "Federal FLSA plus additional protections for certain industries",
    recentChanges: "NYC minimum wage rose to $16.00/hr in 2024. NY WARN Act amendments expand notice requirements. Paid Prenatal Leave effective Jan 2025.",
    risk: "high",
  },
  IL: {
    taxRate: "4.95% flat rate",
    filingFrequency: "Quarterly (UI-3/40)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$14.00/hr (statewide)",
    overtimeRules: "Federal FLSA rules; state law mirrors federal",
    recentChanges: "Minimum wage increased to $14.00/hr in Jan 2024, set to reach $15.00 in 2025. Paid Leave for All Workers Act in effect.",
    risk: "medium",
  },
  PA: {
    taxRate: "3.07% flat rate",
    filingFrequency: "Quarterly (UC-2/2A)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$7.25/hr (federal minimum)",
    overtimeRules: "Federal FLSA rules (1.5x after 40 hrs/week)",
    recentChanges: "No recent minimum wage increase at state level despite ongoing legislative proposals. Philadelphia has local requirements including paid sick leave.",
    risk: "low",
  },
  OH: {
    taxRate: "0% – 3.75% (progressive, starts at $26,050)",
    filingFrequency: "Quarterly",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$10.45/hr (non-tipped); adjusted annually for inflation",
    overtimeRules: "Federal FLSA rules (1.5x after 40 hrs/week)",
    recentChanges: "Minimum wage indexed to CPI, increased to $10.45/hr in 2024. Top income tax bracket reduced from 3.99% to 3.75%.",
    risk: "low",
  },
  GA: {
    taxRate: "1.0% – 5.49% (progressive; migrating to flat 5.39% by 2025)",
    filingFrequency: "Quarterly (DOL-4N)",
    newHireDeadline: "Within 10 days of hire",
    minimumWage: "$5.15/hr (state); federal $7.25/hr applies to covered employers",
    overtimeRules: "Federal FLSA rules (1.5x after 40 hrs/week)",
    recentChanges: "Georgia transitioning to a flat income tax. Rate drops to 5.39% in 2025 and continues decreasing. Shorter new-hire reporting window (10 days).",
    risk: "medium",
  },
  NC: {
    taxRate: "4.5% flat rate (was 4.75% in 2023)",
    filingFrequency: "Quarterly (NCUI 101)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$7.25/hr (federal minimum)",
    overtimeRules: "Federal FLSA rules (1.5x after 40 hrs/week)",
    recentChanges: "Income tax rate reduced to 4.5% in 2024, scheduled to reach 3.99% by 2026. No state minimum wage increase.",
    risk: "low",
  },
  MI: {
    taxRate: "4.25% flat rate",
    filingFrequency: "Quarterly (UIA 1028)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$10.33/hr (increasing to $12.00+ under new schedule)",
    overtimeRules: "Federal FLSA rules (1.5x after 40 hrs/week)",
    recentChanges: "Michigan Supreme Court ruling restored original ballot measures. Minimum wage and paid sick leave expansions taking effect. Tipped wage to be phased out.",
    risk: "high",
  },
  NJ: {
    taxRate: "1.4% – 10.75% (progressive, 7 brackets)",
    filingFrequency: "Quarterly (NJ-927/WR-30)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$15.13/hr (indexed to CPI)",
    overtimeRules: "Federal FLSA rules; additional protections in some industries",
    recentChanges: "Minimum wage tied to CPI, rose to $15.13 in 2024. Temporary workers' bill of rights enacted. Transit benefit requirements updated.",
    risk: "medium",
  },
  VA: {
    taxRate: "2.0% – 5.75% (progressive, 4 brackets)",
    filingFrequency: "Quarterly (FC-20/21)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$12.00/hr",
    overtimeRules: "Virginia Overtime Wage Act mirrors federal FLSA",
    recentChanges: "Minimum wage held at $12.00/hr. Planned increases to $13.50/$15.00 paused pending legislative action. Overtime Wage Act provides additional enforcement mechanisms.",
    risk: "medium",
  },
  WA: {
    taxRate: "No state income tax",
    filingFrequency: "Quarterly",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$16.28/hr (indexed to CPI; Seattle $19.97/hr)",
    overtimeRules: "Federal FLSA rules; salaried threshold may exceed federal level",
    recentChanges: "Minimum wage rose to $16.28/hr in 2024 (CPI-adjusted). WA Cares Fund long-term care payroll tax in effect (0.58%). Capital gains tax upheld by courts.",
    risk: "medium",
  },
  AZ: {
    taxRate: "2.5% flat rate",
    filingFrequency: "Quarterly (UC-018/020)",
    newHireDeadline: "Within 20 days of hire",
    minimumWage: "$14.35/hr (indexed to CPI)",
    overtimeRules: "Federal FLSA rules (1.5x after 40 hrs/week)",
    recentChanges: "Flat tax of 2.5% fully in effect as of 2023. Minimum wage indexed to inflation, rose to $14.35 in 2024. E-Verify mandatory for all employers.",
    risk: "low",
  },
  MA: {
    taxRate: "5.0% flat rate (+ 4% surtax on income > $1M)",
    filingFrequency: "Quarterly",
    newHireDeadline: "Within 14 days of hire",
    minimumWage: "$15.00/hr",
    overtimeRules: "1.5x after 40 hrs/week; Sunday/holiday premium being phased out",
    recentChanges: "\"Millionaire's tax\" (4% surtax on income over $1M) in effect since 2023. Sunday/holiday premium pay phasing down. PFML contribution rates updated annually.",
    risk: "high",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function Home() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [discountUrl, setDiscountUrl] = useState<string | null>(null);
  const [loadingDiscount, setLoadingDiscount] = useState(false);

  function toggleState(abbr: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(abbr)) next.delete(abbr);
      else next.add(abbr);
      return next;
    });
    setShowResults(false);
  }

  function handleCheck() {
    if (selected.size === 0) return;
    setShowResults(true);
  }

  async function handleGetDiscount() {
    setLoadingDiscount(true);
    try {
      const res = await fetch("/api/discount", { method: "POST" });
      const data = await res.json();
      setDiscountCode(data.code);
      setDiscountUrl(data.url);
    } catch {
      // ignore
    } finally {
      setLoadingDiscount(false);
    }
  }

  function riskLabel(risk: "low" | "medium" | "high") {
    if (risk === "low") return <span className="badge badge-green">Low Risk</span>;
    if (risk === "medium") return <span className="badge badge-yellow">Medium Risk</span>;
    return <span className="badge badge-red">High Risk</span>;
  }

  const sortedSelected = Array.from(selected).sort();

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <h1>Check Your Payroll Compliance</h1>
        <p>
          Select which US states you operate in and get an instant compliance
          summary covering taxes, filing deadlines, wages, and more.
        </p>
      </section>

      {/* State Selector */}
      <section className="state-selector">
        <h2>Select Your States</h2>
        <div className="state-grid">
          {ALL_STATES.map((abbr) => (
            <button
              key={abbr}
              className={`state-btn${selected.has(abbr) ? " selected" : ""}`}
              onClick={() => toggleState(abbr)}
              aria-pressed={selected.has(abbr)}
            >
              {abbr}
            </button>
          ))}
        </div>
        <p className="selected-count">
          {selected.size === 0
            ? "No states selected"
            : `${selected.size} state${selected.size > 1 ? "s" : ""} selected`}
        </p>
      </section>

      {/* Check Button */}
      <div className="check-btn-wrap">
        <button
          className="btn-primary"
          disabled={selected.size === 0}
          onClick={handleCheck}
        >
          Check Compliance
        </button>
      </div>

      {/* Results */}
      {showResults && (
        <section className="results-section">
          <h2>Compliance Report</h2>
          <div className="results-grid">
            {sortedSelected.map((abbr) => {
              const data = COMPLIANCE_DATA[abbr];
              const name = STATE_NAMES[abbr] || abbr;

              if (!data) {
                return (
                  <div key={abbr} className="report-card">
                    <div className="report-card-header">
                      <h3>
                        {name}
                        <span className="abbr">({abbr})</span>
                      </h3>
                      <span className="badge badge-yellow">Pending</span>
                    </div>
                    <div className="report-card-body">
                      <p className="loading-text">
                        Detailed compliance data for {name} is loading and will
                        be available soon. Core federal requirements (FLSA, FUTA,
                        FICA) still apply.
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={abbr} className="report-card">
                  <div className="report-card-header">
                    <h3>
                      {name}
                      <span className="abbr">({abbr})</span>
                    </h3>
                    {riskLabel(data.risk)}
                  </div>
                  <div className="report-card-body">
                    <table>
                      <tbody>
                        <tr>
                          <td>State Income Tax</td>
                          <td>{data.taxRate}</td>
                        </tr>
                        <tr>
                          <td>Filing Frequency</td>
                          <td>{data.filingFrequency}</td>
                        </tr>
                        <tr>
                          <td>New Hire Reporting</td>
                          <td>{data.newHireDeadline}</td>
                        </tr>
                        <tr>
                          <td>Minimum Wage</td>
                          <td>{data.minimumWage}</td>
                        </tr>
                        <tr>
                          <td>Overtime Rules</td>
                          <td>{data.overtimeRules}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="recent-changes">
                      <strong>Recent Changes</strong>
                      {data.recentChanges}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="faq-section">
        <h2>Frequently Asked Questions</h2>
        <details>
          <summary>What is a payroll compliance check?</summary>
          <p>
            A payroll compliance check verifies that your business meets all
            federal and state payroll requirements, including tax withholding
            rates, minimum wage laws, pay frequency rules, and overtime
            regulations.
          </p>
        </details>
        <details>
          <summary>Is this payroll compliance tool free?</summary>
          <p>
            Yes, our multi-state payroll compliance checker is completely free.
            Check compliance requirements for all 50 US states instantly.
          </p>
        </details>
        <details>
          <summary>What does a state payroll compliance report include?</summary>
          <p>
            Each state report covers state income tax rates, minimum wage, pay
            frequency requirements, overtime rules, new hire reporting deadlines,
            and key compliance notes specific to that state.
          </p>
        </details>
        <details>
          <summary>How often do payroll compliance requirements change?</summary>
          <p>
            Payroll regulations can change annually or even mid-year. State
            minimum wages, tax rates, and reporting requirements are updated
            regularly. We keep our data current to reflect the latest
            requirements.
          </p>
        </details>
        <details>
          <summary>Do I need a payroll compliance check for each state?</summary>
          <p>
            Yes, if you have employees in multiple states, each state has its own
            payroll tax rates, minimum wage, overtime rules, and reporting
            requirements. Our tool lets you check all 50 states.
          </p>
        </details>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Need Ongoing Compliance Monitoring?</h2>
        <p>
          Stay compliant across all 50 states with automated alerts, deadline
          tracking, and real-time regulatory updates from Payroll Beacon.
        </p>
        {discountCode ? (
          <div className="discount-result">
            <div>Your exclusive code:</div>
            <div className="code">{discountCode}</div>
            <a
              href={discountUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Sign up for 20% off at Payroll Beacon &rarr;
            </a>
          </div>
        ) : (
          <button
            className="btn-primary"
            onClick={handleGetDiscount}
            disabled={loadingDiscount}
          >
            {loadingDiscount ? "Generating..." : "Get 20% Off Payroll Beacon"}
          </button>
        )}
      </section>
    </>
  );
}

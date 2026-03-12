"use client";

import { useState } from "react";

interface BudgetInputs {
  income: number;
  rent: number;
  car: number;
  utilities: number;
  subscriptions: number;
  groceries: number;
  debt: number;
  other: number;
}

interface Results {
  totalIncome: number;
  totalExpenses: number;
  remaining: number;
  savingsRate: number;
  dtiRatio: number;
  needs: number;
  wants: number;
  categories: { name: string; amount: number; color: string }[];
}

const initialInputs: BudgetInputs = {
  income: 0,
  rent: 0,
  car: 0,
  utilities: 0,
  subscriptions: 0,
  groceries: 0,
  debt: 0,
  other: 0,
};

function fmt(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function pct(n: number): string {
  return n.toFixed(1) + "%";
}

export default function Home() {
  const [inputs, setInputs] = useState<BudgetInputs>(initialInputs);
  const [results, setResults] = useState<Results | null>(null);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);

  const update = (field: keyof BudgetInputs, value: string) => {
    const num = parseFloat(value) || 0;
    setInputs((prev) => ({ ...prev, [field]: num }));
  };

  const calculate = () => {
    const totalIncome = inputs.income;
    const totalExpenses =
      inputs.rent +
      inputs.car +
      inputs.utilities +
      inputs.subscriptions +
      inputs.groceries +
      inputs.debt +
      inputs.other;
    const remaining = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (remaining / totalIncome) * 100 : 0;
    const dtiRatio = totalIncome > 0 ? (inputs.debt / totalIncome) * 100 : 0;

    // Needs: rent, utilities, groceries, debt
    const needs = inputs.rent + inputs.utilities + inputs.groceries + inputs.debt;
    // Wants: car, subscriptions, other
    const wants = inputs.car + inputs.subscriptions + inputs.other;

    const categories: { name: string; amount: number; color: string }[] = [];
    if (inputs.rent > 0) categories.push({ name: "Rent / Mortgage", amount: inputs.rent, color: "#3b82f6" });
    if (inputs.car > 0) categories.push({ name: "Car Payment", amount: inputs.car, color: "#8b5cf6" });
    if (inputs.utilities > 0) categories.push({ name: "Utilities", amount: inputs.utilities, color: "#f59e0b" });
    if (inputs.subscriptions > 0) categories.push({ name: "Subscriptions", amount: inputs.subscriptions, color: "#ec4899" });
    if (inputs.groceries > 0) categories.push({ name: "Groceries", amount: inputs.groceries, color: "#f97316" });
    if (inputs.debt > 0) categories.push({ name: "Debt Payments", amount: inputs.debt, color: "#ef4444" });
    if (inputs.other > 0) categories.push({ name: "Other", amount: inputs.other, color: "#64748b" });
    if (remaining > 0) categories.push({ name: "Remaining", amount: remaining, color: "#10b981" });

    setResults({
      totalIncome,
      totalExpenses,
      remaining,
      savingsRate,
      dtiRatio,
      needs,
      wants,
      categories,
    });
  };

  const getDiscountCode = async () => {
    setLoadingCode(true);
    try {
      const res = await fetch("/api/discount", { method: "POST" });
      const data = await res.json();
      setDiscountCode(data.code);
    } catch {
      setDiscountCode("BB-SAVE20");
    } finally {
      setLoadingCode(false);
    }
  };

  const buildPieGradient = () => {
    if (!results || results.categories.length === 0) return "conic-gradient(#e2e8f0 0deg 360deg)";
    const total = results.categories.reduce((s, c) => s + c.amount, 0);
    if (total === 0) return "conic-gradient(#e2e8f0 0deg 360deg)";
    let cumulative = 0;
    const stops = results.categories.map((cat) => {
      const start = (cumulative / total) * 360;
      cumulative += cat.amount;
      const end = (cumulative / total) * 360;
      return `${cat.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  };

  const barPct = (actual: number, income: number) => {
    if (income <= 0) return 0;
    return Math.min((actual / income) * 100, 100);
  };

  return (
    <>
      <section className="hero">
        <h1>
          Check Your <span className="accent">Budget</span> in Seconds
        </h1>
        <p>
          See your cash flow, savings rate, and personalized recommendations
          &mdash; 100% private, calculated in your browser.
        </p>
      </section>

      <div className="container">
        {/* Input Form */}
        <div className="form-section">
          <h2>Enter Your Monthly Finances</h2>
          <div className="form-grid">
            <InputField
              label="Monthly Income"
              sublabel="After tax"
              value={inputs.income}
              onChange={(v) => update("income", v)}
              placeholder="5,000"
            />
            <InputField
              label="Rent / Mortgage"
              value={inputs.rent}
              onChange={(v) => update("rent", v)}
              placeholder="1,500"
            />
            <InputField
              label="Car Payment"
              value={inputs.car}
              onChange={(v) => update("car", v)}
              placeholder="350"
            />
            <InputField
              label="Utilities"
              sublabel="Electric, water, internet"
              value={inputs.utilities}
              onChange={(v) => update("utilities", v)}
              placeholder="200"
            />
            <InputField
              label="Subscriptions"
              sublabel="Streaming, gym, etc."
              value={inputs.subscriptions}
              onChange={(v) => update("subscriptions", v)}
              placeholder="100"
            />
            <InputField
              label="Groceries"
              value={inputs.groceries}
              onChange={(v) => update("groceries", v)}
              placeholder="400"
            />
            <InputField
              label="Debt Payments"
              sublabel="Credit cards, loans"
              value={inputs.debt}
              onChange={(v) => update("debt", v)}
              placeholder="200"
            />
            <InputField
              label="Other Expenses"
              value={inputs.other}
              onChange={(v) => update("other", v)}
              placeholder="300"
            />
          </div>
          <button className="calculate-btn" onClick={calculate}>
            Calculate My Budget
          </button>
        </div>

        {/* Results */}
        {results && (
          <div className="results">
            {/* Summary Cards */}
            <div className="summary-cards">
              <div className="summary-card">
                <div className="label">Total Income</div>
                <div className="value neutral">{fmt(results.totalIncome)}</div>
              </div>
              <div className="summary-card">
                <div className="label">Total Expenses</div>
                <div className="value neutral">{fmt(results.totalExpenses)}</div>
              </div>
              <div className="summary-card">
                <div className="label">Remaining Cash</div>
                <div
                  className={`value ${results.remaining >= 0 ? "positive" : "negative"}`}
                >
                  {fmt(results.remaining)}
                </div>
              </div>
            </div>

            {/* 50/30/20 Breakdown */}
            <div className="section-card">
              <h3>50 / 30 / 20 Budget Breakdown</h3>
              <BreakdownRow
                label="Needs (50%)"
                actual={results.needs}
                recommended={results.totalIncome * 0.5}
                income={results.totalIncome}
                color="#3b82f6"
              />
              <BreakdownRow
                label="Wants (30%)"
                actual={results.wants}
                recommended={results.totalIncome * 0.3}
                income={results.totalIncome}
                color="#8b5cf6"
              />
              <BreakdownRow
                label="Savings (20%)"
                actual={Math.max(results.remaining, 0)}
                recommended={results.totalIncome * 0.2}
                income={results.totalIncome}
                color="#10b981"
              />
            </div>

            {/* Key Metrics */}
            <div className="section-card">
              <h3>Key Metrics</h3>
              <div className="metric-row">
                <div className="metric-info">
                  <h4>Savings Rate</h4>
                  <p>Percentage of income you keep</p>
                </div>
                <div>
                  <span className="metric-value">{pct(results.savingsRate)}</span>
                  <span
                    className={`metric-badge ${
                      results.savingsRate >= 20
                        ? "badge-green"
                        : results.savingsRate >= 10
                        ? "badge-yellow"
                        : "badge-red"
                    }`}
                  >
                    {results.savingsRate >= 20
                      ? "Great"
                      : results.savingsRate >= 10
                      ? "Fair"
                      : "Low"}
                  </span>
                </div>
              </div>
              <div className="metric-row">
                <div className="metric-info">
                  <h4>Debt-to-Income Ratio</h4>
                  <p>
                    {results.dtiRatio > 36
                      ? "Above 36% — lenders may see this as risky"
                      : "Below 36% — within healthy range"}
                  </p>
                </div>
                <div>
                  <span className="metric-value">{pct(results.dtiRatio)}</span>
                  <span
                    className={`metric-badge ${
                      results.dtiRatio <= 20
                        ? "badge-green"
                        : results.dtiRatio <= 36
                        ? "badge-yellow"
                        : "badge-red"
                    }`}
                  >
                    {results.dtiRatio <= 20
                      ? "Healthy"
                      : results.dtiRatio <= 36
                      ? "Moderate"
                      : "High"}
                  </span>
                </div>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="section-card">
              <h3>Expense Breakdown</h3>
              <div className="pie-chart-container">
                <div
                  className="pie-chart"
                  style={{ background: buildPieGradient() }}
                />
                <div className="pie-legend">
                  {results.categories.map((cat) => (
                    <div className="pie-legend-item" key={cat.name}>
                      <span
                        className="pie-legend-dot"
                        style={{ background: cat.color }}
                      />
                      <span>{cat.name}</span>
                      <span>{fmt(cat.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cash Flow Bar */}
            <div className="section-card">
              <h3>Cash Flow Overview</h3>
              <div className="cashflow-bar-container">
                <div className="cashflow-label-row">
                  <span>
                    <strong>Income:</strong> {fmt(results.totalIncome)}
                  </span>
                  <span>
                    <strong>Expenses:</strong> {fmt(results.totalExpenses)}
                  </span>
                </div>
                <div className="cashflow-bar-bg">
                  <div
                    className="cashflow-bar-income"
                    style={{ width: "100%" }}
                  >
                    Income
                  </div>
                  <div
                    className="cashflow-bar-expense"
                    style={{
                      width: `${barPct(results.totalExpenses, results.totalIncome)}%`,
                    }}
                  />
                </div>
                <div
                  className="cashflow-label-row"
                  style={{ marginTop: "0.5rem" }}
                >
                  <span style={{ color: "#10b981", fontWeight: 600 }}>
                    {results.remaining >= 0
                      ? `+${fmt(results.remaining)} surplus`
                      : `${fmt(results.remaining)} deficit`}
                  </span>
                  <span style={{ color: "#64748b", fontSize: "0.8rem" }}>
                    {results.totalIncome > 0
                      ? `${pct((results.totalExpenses / results.totalIncome) * 100)} of income spent`
                      : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="section-card faq-section">
              <h3>Frequently Asked Questions</h3>
              <details className="faq-item">
                <summary>What is the 50/30/20 budget rule?</summary>
                <p>
                  The 50/30/20 rule is a budgeting guideline that allocates 50%
                  of after-tax income to needs (housing, utilities, groceries),
                  30% to wants (dining, entertainment, subscriptions), and 20%
                  to savings and debt repayment.
                </p>
              </details>
              <details className="faq-item">
                <summary>Is the Instant Budget Check free?</summary>
                <p>
                  Yes, our budget calculator is completely free and runs entirely
                  in your browser. No data is sent to any server &mdash; your
                  financial information stays private.
                </p>
              </details>
              <details className="faq-item">
                <summary>What is a good savings rate?</summary>
                <p>
                  Financial experts recommend saving at least 20% of your
                  after-tax income. A savings rate above 20% is excellent,
                  10&ndash;20% is good, and below 10% suggests you should look
                  for ways to reduce expenses.
                </p>
              </details>
              <details className="faq-item">
                <summary>What is debt-to-income ratio?</summary>
                <p>
                  Debt-to-income (DTI) ratio is the percentage of your monthly
                  income that goes toward debt payments. A DTI below 20% is
                  healthy, 20&ndash;35% is manageable, and above 35% may
                  indicate financial stress.
                </p>
              </details>
              <details className="faq-item">
                <summary>How accurate is this budget calculator?</summary>
                <p>
                  The calculator provides an accurate breakdown based on the
                  numbers you enter. It uses the widely-accepted 50/30/20
                  framework. For comprehensive financial planning, consider
                  consulting a financial advisor.
                </p>
              </details>
            </div>

            {/* CTA */}
            <div className="cta-section">
              <h3>Want to See Your Cash Flow 24 Months Ahead?</h3>
              <p>
                Visualize your budget on an interactive calendar. Plan for big
                purchases, track trends, and stay on top of every dollar.
              </p>
              <a
                href="https://budgetingbeacon.com"
                target="_blank"
                rel="noopener noreferrer"
                className="cta-btn"
              >
                Try Budgeting Beacon
              </a>
              {!discountCode ? (
                <div style={{ marginTop: "1rem" }}>
                  <button
                    className="cta-btn"
                    style={{
                      background: "white",
                      color: "var(--accent-dark)",
                      border: "2px solid var(--accent)",
                    }}
                    onClick={getDiscountCode}
                    disabled={loadingCode}
                  >
                    {loadingCode ? "Generating..." : "Get 20% Discount Code"}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="discount-code">{discountCode}</div>
                  <div className="discount-note">
                    20% off your first year &mdash; apply at checkout
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function InputField({
  label,
  sublabel,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  sublabel?: string;
  value: number;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="input-group">
      <label>
        {label}
        {sublabel && <span className="sublabel"> ({sublabel})</span>}
      </label>
      <div className="input-wrapper">
        <span className="currency">$</span>
        <input
          type="number"
          min="0"
          step="1"
          placeholder={placeholder}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  actual,
  recommended,
  income,
  color,
}: {
  label: string;
  actual: number;
  recommended: number;
  income: number;
  color: string;
}) {
  const actualPct = income > 0 ? (actual / income) * 100 : 0;
  const recommendedPct = label.includes("50")
    ? 50
    : label.includes("30")
    ? 30
    : 20;

  return (
    <div className="breakdown-row">
      <span className="breakdown-label">{label}</span>
      <div className="breakdown-bar-container">
        <div className="breakdown-bar-bg">
          <div
            className="breakdown-bar-fill"
            style={{
              width: `${Math.min(actualPct, 100)}%`,
              background: actualPct > recommendedPct ? "#ef4444" : color,
            }}
          />
          <div
            className="breakdown-bar-recommended"
            style={{ left: `${recommendedPct}%` }}
            title={`Recommended: ${recommendedPct}%`}
          />
        </div>
      </div>
      <div className="breakdown-values">
        <strong>{fmt(actual)}</strong> / {fmt(recommended)}
        <br />
        <span>
          {pct(actualPct)} actual vs {recommendedPct}% target
        </span>
      </div>
    </div>
  );
}

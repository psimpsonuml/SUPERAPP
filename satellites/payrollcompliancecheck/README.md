# Payroll Compliance Check

A free multi-state payroll compliance checking tool. Select the US states you operate in and get an instant compliance summary covering tax rates, filing requirements, minimum wage, overtime rules, and more.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `PB_SUPABASE_URL` | Your Supabase project URL |
| `PB_SUPABASE_ANON_KEY` | Your Supabase anonymous key |
| `STRIPE_SECRET_KEY_PB` | Stripe secret key for discount code generation |

> Note: The initial version uses hardcoded state data and does not require Supabase or Stripe to function.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Vercel will auto-detect the Next.js framework via `vercel.json`.
4. Add your environment variables in the Vercel dashboard under Settings > Environment Variables.
5. Deploy.

## Features

- Multi-state selection grid (all 50 states + DC)
- Instant compliance report cards per state
- State income tax rates, filing frequency, new hire reporting deadlines
- Minimum wage and overtime rules
- Color-coded compliance risk badges
- Discount code generation for Payroll Beacon upgrade

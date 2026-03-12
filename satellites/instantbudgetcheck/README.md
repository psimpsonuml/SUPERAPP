# Instant Budget Check

A free, client-side budget calculator built with Next.js. All calculations happen in the browser — no data is sent to any server.

## Features

- Monthly income and expense input
- 50/30/20 budget breakdown with visual progress bars
- Savings rate and debt-to-income ratio analysis
- CSS pie chart showing expense categories
- Cash flow overview bar
- Fully responsive design

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```
STRIPE_SECRET_KEY_BB=sk_live_xxx
```

The Stripe key is only used by the `/api/discount` endpoint to generate discount codes (placeholder implementation).

## Deployment

Deploy to Vercel:

```bash
vercel
```

The `vercel.json` is pre-configured for Next.js.

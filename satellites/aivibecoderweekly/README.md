# AI Vibe Coder Weekly

A lightweight Next.js static blog that reads content from Supabase.

## Setup

1. Clone this repo
2. Copy `.env.example` to `.env.local` and fill in your Supabase credentials
3. Edit `config.ts` to customize the blog identity, colors, and categories
4. Deploy to Vercel:

```bash
npm install
npm run dev    # local development
npm run build  # production build
```

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Set environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Features

- Static generation with ISR (5-minute revalidation)
- Category filtering and search
- RSS feed at `/feed.xml`
- Auto-generated sitemap at `/sitemap.xml`
- Robots.txt allowing full crawling
- OG meta tags per post
- Clean, responsive, light theme
- Sub-2-second page loads

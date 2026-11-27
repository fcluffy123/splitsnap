# SplitSnap 📸🧾

Mobile-first web app to split a restaurant bill fairly: snap a receipt, tap who ate what, and see exactly who owes what — with tax, service charge and tip split proportionally.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Google Gemini** (`gemini-flash-latest`) reads the receipt photo via the server route `/api/scan` — the API key stays in `.env.local` and never reaches the browser
- **No database** — state in React + `localStorage`
- Deployable free on **Vercel**

## Run locally

```bash
npm install
cp .env.local.example .env.local   # then paste your GEMINI_API_KEY (get one at https://aistudio.google.com/apikey)
npm run dev                          # http://localhost:3000
```

## Test & build

```bash
npm test        # unit tests for the money math (lib/split.ts) and scan validation (lib/scan.ts)
npm run build   # production build
```

## How it works

1. **People** — add at least 2 people (colored chips)
2. **Items** — scan a receipt photo (compressed < 1 MB in the browser, sent to Gemini as JSON) or add items manually; tap people chips under each item to assign it (shared items split evenly)
3. **Extras** — tax %, service charge %, tip (% or fixed amount), split **proportionally to each person's subtotal**
4. **Results** — one card per person; unassigned items are flagged; the first person absorbs the rounding leftover so totals sum exactly to the bill total

All money math lives in `lib/split.ts` (pure functions, unit-tested).

## Project structure

```
app/page.tsx            4-step wizard + localStorage persistence
app/api/scan/route.ts   Gemini receipt scan (server-side, key stays secret)
components/             PeopleStep, ItemsStep, ExtrasStep, ResultsStep, ScanButton
lib/split.ts            all money math + currency formatting
lib/scan.ts             scan-result validation (shared client/server)
lib/compressImage.ts    browser-side image compression to < 1 MB
```

## Deploy to Vercel

1. Push this repo to GitHub
2. Import it at https://vercel.com/new
3. Add environment variable `GEMINI_API_KEY` in the Vercel project settings
4. Deploy — done

⚠️ Never commit `.env.local` (it's gitignored).

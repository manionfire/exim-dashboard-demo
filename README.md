# Exim Bank Social Media Intelligence Dashboard (Demo)

Static HTML/CSS/JS dashboard that pulls together Meta (Facebook/Instagram), TikTok, YouTube, LinkedIn, WhatsApp and website metrics for Exim Bank. It runs on dummy data from `data.json`; nothing connects to a live API.

> All figures are illustrative and based on public benchmarks, not Exim Bank account data. The logo in the header is a placeholder wordmark. Swap in the official logo file before sharing externally.

## What's in it

| Section | Details |
|---|---|
| KPI cards | Impressions, engagement, net follower growth, website sessions. Each shows % change vs prior period and a sparkline |
| Channel mix | Doughnut of impressions by platform |
| Engagement trend | TikTok / Instagram / Facebook / YouTube, toggle daily (30 d), weekly (12 wk), monthly (6 mo) |
| Benchmark vs actual | Indexed bar chart (benchmark = 100) with green/red indicators |
| Sentiment | Semi-circle gauge, net sentiment score, top conversation themes |
| Top posts | 6-post grid ranked by engagement rate, click for a detail modal |
| WhatsApp funnel / web sources | Sent → delivered → read → replied, sessions by source |
| Tables | Channel performance and anonymised competitor snapshot, each with CSV export |
| Recommendations | 4 prioritised strategy cards |
| Export | Full-report CSV, Save as PDF, Print (A4 print stylesheet hides controls) |

## Files

```
index.html   Dashboard markup
styles.css   Brand styling (Exim Blue #002B5C, Gold #F5A623, DM Sans) + print CSS
app.js       Chart.js setup, data binding, CSV/print export
data.json    All dummy metrics, the only file you need to edit to change numbers
```

## Run locally

`app.js` fetches `data.json`, and browsers block that over `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating the data

Edit `data.json` and click **Refresh** in the dashboard (it re-fetches without cache). Key shapes:

- `summary.<kpi>` → `{ value, previous, spark[12] }`
- `channels.<platform>` → followers, growth, impressions, engagements, engagementRate (0–1)
- `trend` → `dates[]` plus one daily array per channel (182 days)
- `benchmarks[]`, `competitors[]`, `sentiment`, `topPosts[]`, `recommendations[]`

## Deploy: GitHub

```bash
git init
git add .
git commit -m "Initial commit: Exim Bank dashboard demo"
git branch -M main
git remote add origin https://github.com/<username>/exim-dashboard-demo.git
git push -u origin main
```

## Deploy: Vercel

1. Sign in at vercel.com with GitHub.
2. **Add New Project → Import Git Repository** → pick `exim-dashboard-demo`.
3. Framework preset **Other**. Leave Build Command, Output Directory and Install Command empty.
4. **Deploy**. You get a URL like `https://exim-dashboard-demo.vercel.app`.

Every push to `main` redeploys production; pull requests get preview URLs. No `vercel.json` or environment variables are needed.

## Path to live data

Replace `DATA_URL` in `app.js` with an endpoint that returns the same JSON shape, for example a Google Sheet published via Apps Script and fed by Supermetrics or Reportei. For the final build, a Looker Studio embed can replace individual charts.

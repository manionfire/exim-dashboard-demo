# Exim Bank Social Media Intelligence Dashboard (Demo)

Static HTML/CSS/JS dashboard for Exim Bank covering Facebook, Instagram, YouTube, TikTok, WhatsApp and the website for Q3 2026 (1 Jul – 30 Sep). Data comes from `data.json`; nothing connects to a live API.

> **Data provenance.** The dashboard mixes two kinds of figures and labels each card:
> - **Public data**: profile counters, a sample of public posts, Emplifi Q2 2026 bank benchmarks, Instagram peer counts and TCRA market context, each with its date and source.
> - **Simulated**: the PRD example figures in `demoFallbacks` (impressions, engagement, growth, sessions, sentiment, WhatsApp). These are not measured Exim results.
>
> The **Simulated figures** switch in the header hides every simulated value. Open the page with `?view=public` to start in public-only mode (useful for stakeholder links). `null` in the data means "not available", never zero.
>
> The header logo is a placeholder wordmark. Swap in the official logo before sharing externally.

## What's in it

| Section | Source |
|---|---|
| Public profile snapshot (FB, IG, YouTube, TikTok) | Public |
| Q3 KPI cards with Sep-vs-Aug change and sparklines | Simulated |
| Audience by platform (doughnut) | Public |
| Monthly trend: engagement rate by channel, impressions, engagement, sessions | Simulated |
| Benchmark vs Exim | Public benchmark, simulated Exim rate |
| Instagram followers vs CRDB and NMB | Public |
| Sentiment gauge, WhatsApp and website stats | Simulated (empty state when hidden) |
| Q3 public post sample (12 posts, popup with link to the original) | Public |
| Visible interactions per post, TCRA platform data usage | Public |
| Channel overview table (public and simulated in separate columns) | Mixed, CSV export |
| Recommendations, sources and data-quality notes | From `data.json` |
| Export | Full-report CSV, Save as PDF, Print (A4) |

## Files

```
index.html   Dashboard markup
styles.css   Brand styling (Exim Blue #002B5C, Gold #F5A623, DM Sans) + print CSS
app.js       Chart.js setup, data binding, CSV/print export
data.json    Public observations, sources and labelled simulated fallbacks
```

## Run locally

`app.js` fetches `data.json`, and browsers block that over `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating the data

Edit `data.json` and click **Refresh** (it re-fetches without cache). Key parts:

- `channels.<platform>`: real values; `null` where not public. When an authorised analytics export fills these in, the dashboard uses them instead of the simulated fallback.
- `summary`, `sentiment`: real values, currently `null`.
- `publicObservations`: public posts, TikTok posts, competitor snapshots, TCRA market context.
- `benchmarks`: Emplifi bank medians with period and definition.
- `demoFallbacks`: simulated PRD figures (`enabled: false` removes them from the page entirely).
- `recommendations`, `sources`, `dataQualityNotes`: rendered as-is.

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

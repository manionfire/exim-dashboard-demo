/* Exim Bank Social Media Dashboard — demo
 * All metrics come from data.json. To go live later, point DATA_URL at an API
 * or a published Google Sheet that returns the same shape.
 */
(function () {
  'use strict';

  const DATA_URL = 'data.json';

  const C = {
    blue: '#002B5C', blue80: '#33557D', blue60: '#66809D', blue30: '#B3BFCE', blue10: '#E6EAEF',
    gold: '#F5A623', goldDark: '#C98510', gold50: '#FAD291',
    good: '#1E8E5A', bad: '#C8102E', neutral: '#B3BFCE',
    text: '#1A1A2E', muted: '#5B6578', grid: '#EEF1F5'
  };

  // Blue first, gold second, then tints (brand data-viz order)
  const CHANNEL_COLORS = {
    tiktok: C.blue, instagram: C.gold, facebook: C.blue60, youtube: C.goldDark, linkedin: C.blue30,
    whatsapp: C.good, website: C.muted
  };
  const SOCIAL = ['tiktok', 'instagram', 'facebook', 'youtube', 'linkedin'];
  const TREND_CHANNELS = ['tiktok', 'instagram', 'facebook', 'youtube'];

  const charts = {};
  let state = { data: null, gran: 'daily' };

  // ---------- Formatting ----------
  const fmtInt = new Intl.NumberFormat('en-US');
  const fmtCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  const num = (v) => fmtInt.format(Math.round(v));
  const compact = (v) => fmtCompact.format(v);
  const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
  const change = (cur, prev) => (cur - prev) / prev;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Chart.js defaults ----------
  Chart.defaults.font.family = '"DM Sans", system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = C.muted;
  Chart.defaults.plugins.tooltip.backgroundColor = C.blue;
  Chart.defaults.plugins.tooltip.titleColor = '#fff';
  Chart.defaults.plugins.tooltip.bodyColor = '#fff';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
  Chart.defaults.maintainAspectRatio = false;

  function makeChart(id, config) {
    if (charts[id]) charts[id].destroy();
    const el = document.getElementById(id);
    if (!el) return null;
    charts[id] = new Chart(el, config);
    return charts[id];
  }

  // ---------- Data loading ----------
  async function load() {
    const res = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function init(isRefresh) {
    const btn = $('#refresh-btn');
    btn.classList.add('loading');
    btn.disabled = true;
    try {
      state.data = await load();
      render(state.data);
      if (isRefresh) toast('Dashboard refreshed from data.json');
    } catch (err) {
      console.error(err);
      $('#kpi-row').innerHTML =
        '<div class="error-box" style="grid-column:1/-1">Could not load <code>data.json</code>. ' +
        'Browsers block this when the page is opened straight from disk. Run ' +
        '<code>python3 -m http.server 8000</code> in the project folder and open ' +
        '<code>http://localhost:8000</code>.</div>';
    } finally {
      // Let the spinner show briefly so the refresh is visible
      setTimeout(() => { btn.classList.remove('loading'); btn.disabled = false; }, 400);
    }
  }

  function render(d) {
    const updated = new Date(d.lastUpdated);
    $('#last-updated').textContent = updated.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam'
    }) + ' EAT';
    $('#period-label').textContent = d.period.label + ' · ' + d.period.comparison;

    renderKPIs(d);
    renderChannelMix(d);
    renderTrend(d);
    renderBenchmarks(d);
    renderSentiment(d);
    renderPosts(d);
    renderWhatsApp(d);
    renderWebSources(d);
    renderChannelTable(d);
    renderCompetitorTable(d);
    renderRecommendations(d);
  }

  // ---------- KPI cards ----------
  function renderKPIs(d) {
    const s = d.summary;
    const items = [
      { key: 'totalImpressions', label: 'Total impressions', color: C.blue },
      { key: 'totalEngagement', label: 'Total engagement', color: C.gold },
      { key: 'netFollowerGrowth', label: 'Net follower growth', color: C.blue, prefix: '+' },
      { key: 'websiteSessions', label: 'Website sessions', color: C.gold }
    ];
    $('#kpi-row').innerHTML = items.map((it) => {
      const m = s[it.key];
      const ch = change(m.value, m.previous);
      const up = ch >= 0;
      return `<div class="kpi">
        <span class="kpi-label">${it.label}</span>
        <span class="kpi-value" title="${num(m.value)}">${it.prefix || ''}${compact(m.value)}</span>
        <span class="kpi-meta"><span class="delta ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${pct(Math.abs(ch))}</span>vs ${compact(m.previous)} prior</span>
        <div class="kpi-spark"><canvas id="spark-${it.key}"></canvas></div>
      </div>`;
    }).join('');

    items.forEach((it) => {
      const pts = s[it.key].spark;
      makeChart('spark-' + it.key, {
        type: 'line',
        data: {
          labels: pts.map((_, i) => 'Wk ' + (i + 1)),
          datasets: [{
            data: pts, borderColor: it.color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 3, tension: 0.35,
            fill: true, backgroundColor: hexA(it.color, 0.12)
          }]
        },
        options: {
          animation: false,
          plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: (c) => num(c.parsed.y) } } },
          scales: { x: { display: false }, y: { display: false } },
          interaction: { intersect: false, mode: 'index' }
        }
      });
    });
  }

  // ---------- Channel mix ----------
  function renderChannelMix(d) {
    const vals = SOCIAL.map((k) => d.channels[k].impressions);
    const total = vals.reduce((a, b) => a + b, 0);
    makeChart('channel-mix', {
      type: 'doughnut',
      data: {
        labels: SOCIAL.map((k, i) => `${d.channels[k].label}  ${pct(vals[i] / total, 0)}`),
        datasets: [{ data: vals, backgroundColor: SOCIAL.map((k) => CHANNEL_COLORS[k]), borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }]
      },
      options: {
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 14 } },
          tooltip: {
            callbacks: {
              label: (c) => ` ${d.channels[SOCIAL[c.dataIndex]].label}: ${num(c.parsed)} impressions (${pct(c.parsed / total)})`
            }
          }
        }
      },
      plugins: [centerText(() => [compact(total), 'impressions'])]
    });
  }

  // ---------- Engagement trend ----------
  function aggregate(trend, gran) {
    const dates = trend.dates;
    if (gran === 'daily') {
      const n = 30, start = dates.length - n;
      return {
        labels: dates.slice(start).map((s) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
        series: Object.fromEntries(TREND_CHANNELS.map((k) => [k, trend[k].slice(start)])),
        sub: 'Daily engagements, last 30 days'
      };
    }
    if (gran === 'weekly') {
      const weeks = 12, labels = [], series = Object.fromEntries(TREND_CHANNELS.map((k) => [k, []]));
      for (let w = weeks - 1; w >= 0; w--) {
        const end = dates.length - w * 7, start = end - 7;
        labels.push('w/c ' + new Date(dates[start] + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
        TREND_CHANNELS.forEach((k) => series[k].push(sum(trend[k].slice(start, end))));
      }
      return { labels, series, sub: 'Weekly engagements, last 12 weeks' };
    }
    const months = [], idx = {};
    dates.forEach((s, i) => {
      const m = s.slice(0, 7);
      if (!(m in idx)) { idx[m] = months.length; months.push({ m, i: [] }); }
      months[idx[m]].i.push(i);
    });
    return {
      labels: months.map((x) => new Date(x.m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })),
      series: Object.fromEntries(TREND_CHANNELS.map((k) => [k, months.map((x) => sum(x.i.map((i) => trend[k][i])))])),
      sub: 'Monthly engagements, last 6 months'
    };
  }

  function renderTrend(d) {
    const a = aggregate(d.trend, state.gran);
    $('#trend-sub').textContent = a.sub;
    makeChart('engagement-trend', {
      type: 'line',
      data: {
        labels: a.labels,
        datasets: TREND_CHANNELS.map((k) => ({
          label: d.channels[k].label, data: a.series[k], borderColor: CHANNEL_COLORS[k], backgroundColor: CHANNEL_COLORS[k],
          borderWidth: 2.25, tension: 0.3, pointRadius: state.gran === 'daily' ? 0 : 3, pointHoverRadius: 5
        }))
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'end' },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${num(c.parsed.y)}` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => compact(v) } }
        }
      }
    });
  }

  // ---------- Benchmarks ----------
  function renderBenchmarks(d) {
    const b = d.benchmarks;
    const fmtRate = (v) => pct(v, v < 0.1 ? 2 : 1);
    const idx = b.map((x) => Math.round((x.actual / x.benchmark) * 100));
    makeChart('benchmark-chart', {
      type: 'bar',
      data: {
        labels: b.map((x) => x.metric.replace(' rate', '')),
        datasets: [
          { label: 'Exim Bank', data: idx, backgroundColor: idx.map((v) => (v >= 100 ? C.blue : C.bad)), borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7 },
          { label: 'Benchmark', data: b.map(() => 100), backgroundColor: C.blue30, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7 }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => {
                const x = b[c.dataIndex];
                return c.datasetIndex === 0
                  ? ` Exim Bank: ${fmtRate(x.actual)} (index ${c.parsed.x})`
                  : ` Benchmark: ${fmtRate(x.benchmark)}`;
              },
              footer: (items) => 'Source: ' + b[items[0].dataIndex].source
            }
          }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, title: { display: true, text: 'Index (benchmark = 100)' } },
          y: { grid: { display: false }, ticks: { color: C.text } }
        }
      }
    });

    $('#bench-list').innerHTML = b.map((x, i) => {
      const good = x.actual >= x.benchmark;
      const diff = idx[i] - 100;
      return `<li class="${good ? 'good' : 'bad'}">
        <span class="b-name">${esc(x.metric)}</span>
        <span class="b-flag">${good ? '▲' : '▼'} ${diff > 0 ? '+' : ''}${diff}%</span>
        <span class="b-vals">${fmtRate(x.actual)} vs ${fmtRate(x.benchmark)} benchmark</span>
      </li>`;
    }).join('');
  }

  // ---------- Sentiment gauge ----------
  function renderSentiment(d) {
    const s = d.sentiment;
    const parts = [
      { k: 'positive', label: 'Positive', color: C.good },
      { k: 'neutral', label: 'Neutral', color: C.neutral },
      { k: 'negative', label: 'Negative', color: C.bad }
    ];
    makeChart('sentiment-gauge', {
      type: 'doughnut',
      data: {
        labels: parts.map((p) => p.label),
        datasets: [{ data: parts.map((p) => s[p.k]), backgroundColor: parts.map((p) => p.color), borderColor: '#fff', borderWidth: 3 }]
      },
      options: {
        rotation: -90, circumference: 180, cutout: '72%',
        layout: { padding: { bottom: 4 } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${pct(c.parsed, 0)} (${num(c.parsed * s.mentions)} mentions)` } } }
      }
    });
    const net = Math.round((s.positive - s.negative) * 100);
    $('#gauge-center').innerHTML = `<div class="g-val">+${net}</div><div class="g-lbl">Net sentiment score</div>`;
    $('#sentiment-sub').textContent = `${num(s.mentions)} comments and mentions analysed`;
    $('#sentiment-legend').innerHTML = parts.map((p) =>
      `<li><i class="dot" style="background:${p.color}"></i>${p.label} <b>${pct(s[p.k], 0)}</b></li>`).join('');
    $('#themes').innerHTML = s.topThemes.map((t) =>
      `<li><span>${esc(t.theme)}</span><span class="pct">${pct(t.share, 0)}</span><span class="bar"><i style="width:${t.share * 100 / s.topThemes[0].share}%"></i></span></li>`).join('');
  }

  // ---------- Top posts ----------
  const ICONS = {
    Video: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    Reel: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    Image: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z"/></svg>',
    Carousel: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 6h4v11H2zm5 13h10V4H7v15zM9 6h6v11H9zm9 0h4v11h-4z"/></svg>'
  };

  function sortedPosts(d) {
    return [...d.topPosts].sort((a, b) => b.engagementRate - a.engagementRate);
  }

  function renderPosts(d) {
    $('#post-grid').innerHTML = sortedPosts(d).map((p, i) => `
      <button type="button" class="post-card" data-post="${esc(p.id)}" aria-label="Open post ${i + 1}">
        <div class="post-thumb ${i % 2 ? 'alt' : ''}">
          ${ICONS[p.type] || ICONS.Image}
          <span class="rank">#${i + 1}</span>
          <span class="er">${pct(p.engagementRate)}</span>
          <span class="chan">${esc(d.channels[p.channel].label)} · ${esc(p.type)}</span>
        </div>
        <div class="post-info">
          <p class="post-caption">${esc(p.caption)}</p>
          <div class="post-stats"><span>👁 ${compact(p.views)}</span><span>♥ ${compact(p.likes)}</span><span>↗ ${compact(p.shares)}</span></div>
        </div>
      </button>`).join('');
  }

  function openPost(id) {
    const d = state.data;
    const posts = sortedPosts(d);
    const i = posts.findIndex((p) => p.id === id);
    const p = posts[i];
    if (!p) return;
    const date = new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    $('#modal-body').innerHTML = `
      <div class="modal-grid">
        <div class="post-thumb ${i % 2 ? 'alt' : ''}">${ICONS[p.type] || ICONS.Image}<span class="rank">#${i + 1}</span></div>
        <div class="modal-content">
          <span class="meta">${esc(d.channels[p.channel].label)} · ${esc(p.type)} · ${date}</span>
          <h3 id="modal-title">Top post #${i + 1}</h3>
          <p>${esc(p.caption)}</p>
          <div class="modal-stats">
            <div><span>Views</span><b>${num(p.views)}</b></div>
            <div><span>Engagement rate</span><b>${pct(p.engagementRate)}</b></div>
            <div><span>Likes</span><b>${num(p.likes)}</b></div>
            <div><span>Comments</span><b>${num(p.comments)}</b></div>
            <div><span>Shares</span><b>${num(p.shares)}</b></div>
            <div><span>Total engagements</span><b>${num(p.likes + p.comments + p.shares)}</b></div>
          </div>
        </div>
      </div>`;
    const modal = $('#post-modal');
    modal.hidden = false;
    modal.querySelector('.modal-close').focus();
  }

  function closeModal() { $('#post-modal').hidden = true; }

  // ---------- WhatsApp funnel ----------
  function renderWhatsApp(d) {
    const w = d.channels.whatsapp;
    const steps = [['Sent', w.messagesSent], ['Delivered', w.delivered], ['Read', w.read], ['Replied', w.replied]];
    makeChart('whatsapp-funnel', {
      type: 'bar',
      data: {
        labels: steps.map((s) => s[0]),
        datasets: [{ data: steps.map((s) => s[1]), backgroundColor: [C.blue, C.blue80, C.blue60, C.gold], borderRadius: 4, barPercentage: 0.75 }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { displayColors: false, callbacks: { label: (c) => `${num(c.parsed.x)} (${pct(c.parsed.x / w.messagesSent)} of sent)` } }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => compact(v) } },
          y: { grid: { display: false }, ticks: { color: C.text } }
        }
      },
      plugins: [barEndLabels((v) => pct(v / w.messagesSent, 0))]
    });
  }

  // ---------- Website sources ----------
  function renderWebSources(d) {
    const w = d.channels.website;
    const entries = Object.entries(w.sources).sort((a, b) => b[1] - a[1]);
    $('#web-sub').textContent = `${num(w.sessions)} sessions · ${pct(w.bounceRate, 0)} bounce · ${num(w.conversions)} conversions (${pct(w.conversionRate, 2)})`;
    makeChart('web-sources', {
      type: 'bar',
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [{ data: entries.map((e) => e[1]), backgroundColor: entries.map((e) => (e[0] === 'Social' ? C.gold : C.blue)), borderRadius: 4, barPercentage: 0.75 }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { displayColors: false, callbacks: { label: (c) => `${num(c.parsed.x)} sessions (${pct(c.parsed.x / w.sessions)})` } }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => compact(v) } },
          y: { grid: { display: false }, ticks: { color: C.text } }
        }
      },
      plugins: [barEndLabels((v) => pct(v / w.sessions, 0))]
    });
  }

  // ---------- Tables ----------
  function renderChannelTable(d) {
    const rows = SOCIAL.map((k) => {
      const c = d.channels[k];
      return `<tr>
        <td><span class="chan-dot" style="background:${CHANNEL_COLORS[k]}"></span>${esc(c.label)}</td>
        <td class="num">${num(c.followers)}</td>
        <td class="num">+${num(c.followerGrowth)}</td>
        <td class="num">${num(c.impressions)}</td>
        <td class="num">${num(c.engagements)}</td>
        <td class="num">${pct(c.engagementRate)}</td>
        <td class="num">${c.posts}</td>
      </tr>`;
    }).join('');
    $('#channel-table').innerHTML = `<thead><tr>
      <th>Channel</th><th class="num">Followers</th><th class="num">Follower growth</th><th class="num">Impressions</th>
      <th class="num">Engagements</th><th class="num">Engagement rate</th><th class="num">Posts</th>
    </tr></thead><tbody>${rows}</tbody>`;
  }

  function renderCompetitorTable(d) {
    const rows = [...d.competitors].sort((a, b) => b.engagementRate - a.engagementRate).map((c, i) => `
      <tr class="${c.isSelf ? 'self' : ''}">
        <td class="num">${i + 1}</td>
        <td>${esc(c.name)}</td>
        <td class="num">${num(c.followers)}</td>
        <td class="num">${pct(c.engagementRate)}</td>
        <td class="num">${c.postsPerWeek}</td>
      </tr>`).join('');
    $('#competitor-table').innerHTML = `<thead><tr>
      <th class="num">Rank</th><th>Bank</th><th class="num">Total followers</th><th class="num">Avg engagement rate</th><th class="num">Posts / week</th>
    </tr></thead><tbody>${rows}</tbody>`;
  }

  // ---------- Recommendations ----------
  const REC_ICONS = {
    trend: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="m16 6 2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
    web: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.07 16zm2.95-8H5.07a7.99 7.99 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4h-3.38z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21.58 7.19a2.5 2.5 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.5 2.5 0 0 0-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81a2.5 2.5 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.5 2.5 0 0 0 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3L10 15z"/></svg>'
  };

  function renderRecommendations(d) {
    $('#rec-grid').innerHTML = d.recommendations.map((r) => `
      <article class="rec">
        <div class="rec-top">
          <span class="rec-icon">${REC_ICONS[r.icon] || REC_ICONS.trend}</span>
          <span class="badge ${r.priority.toLowerCase()}">${esc(r.priority)} priority</span>
        </div>
        <span class="rec-chan">${esc(r.channel)}</span>
        <h3>${esc(r.title)}</h3>
        <p>${esc(r.text)}</p>
      </article>`).join('');
  }

  // ---------- CSV export ----------
  function tableToRows(tableId) {
    const table = document.getElementById(tableId);
    return [...table.querySelectorAll('tr')].map((tr) =>
      [...tr.querySelectorAll('th,td')].map((cell) => cell.textContent.trim()));
  }

  function toCSV(rows) {
    return rows.map((r) => r.map((v) => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',')).join('\r\n');
  }

  function download(filename, text) {
    const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function stamp() { return (state.data ? state.data.period.end : new Date().toISOString().slice(0, 10)); }

  function exportTableToCSV(tableId) {
    download(`exim-${tableId}-${stamp()}.csv`, toCSV(tableToRows(tableId)));
    toast('CSV downloaded');
  }

  function exportAllCSV() {
    const d = state.data;
    const sections = [
      [['Exim Bank Social Media Dashboard'], ['Period', d.period.label], ['Generated', new Date().toISOString()], []],
      [['KPI', 'Current', 'Previous', 'Change %']].concat(
        Object.entries(d.summary).map(([k, v]) => [k, String(v.value), String(v.previous), (change(v.value, v.previous) * 100).toFixed(1)])),
      [[]], [['CHANNEL PERFORMANCE']], tableToRows('channel-table'),
      [[]], [['COMPETITOR SNAPSHOT']], tableToRows('competitor-table'),
      [[]], [['BENCHMARKS'], ['Metric', 'Actual', 'Benchmark', 'Source']].concat(
        d.benchmarks.map((b) => [b.metric, pct(b.actual, 2), pct(b.benchmark, 2), b.source]))
    ];
    download(`exim-social-report-${stamp()}.csv`, toCSV(sections.flat()));
    toast('Full report CSV downloaded');
  }

  // ---------- Chart helpers ----------
  function centerText(getLines) {
    return {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        const meta = chart.getDatasetMeta(0).data[0];
        if (!meta) return;
        const [a, b] = getLines();
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = C.blue;
        ctx.font = '800 24px "DM Sans", sans-serif';
        ctx.fillText(a, meta.x, meta.y - 8);
        ctx.fillStyle = C.muted;
        ctx.font = '400 12px "DM Sans", sans-serif';
        ctx.fillText(b, meta.x, meta.y + 14);
        ctx.restore();
      }
    };
  }

  function barEndLabels(fmt) {
    return {
      id: 'barEndLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const ds = chart.data.datasets[0];
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const label = fmt(ds.data[i]);
          ctx.save();
          ctx.font = '700 12px "DM Sans", sans-serif';
          const w = ctx.measureText(label).width;
          const inside = bar.x - bar.base > w + 16;
          ctx.fillStyle = inside ? (ds.backgroundColor[i] === C.gold ? C.blue : '#fff') : C.text;
          ctx.textAlign = inside ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, inside ? bar.x - 8 : bar.x + 6, bar.y);
          ctx.restore();
        });
      }
    };
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ---------- Events ----------
  document.addEventListener('click', (e) => {
    const gran = e.target.closest('[data-gran]');
    if (gran && state.data) {
      state.gran = gran.dataset.gran;
      document.querySelectorAll('[data-gran]').forEach((b) => b.classList.toggle('active', b === gran));
      renderTrend(state.data);
      return;
    }
    const post = e.target.closest('[data-post]');
    if (post) return openPost(post.dataset.post);
    if (e.target.closest('[data-close]')) return closeModal();
    const csv = e.target.closest('[data-csv]');
    if (csv) return exportTableToCSV(csv.dataset.csv);
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  $('#refresh-btn').addEventListener('click', () => init(true));
  $('#export-csv').addEventListener('click', () => state.data && exportAllCSV());
  $('#export-print').addEventListener('click', () => window.print());
  $('#export-pdf').addEventListener('click', () => {
    toast('Choose "Save as PDF" as the destination');
    setTimeout(() => window.print(), 600);
  });

  // Resize charts to the print layout and back
  const resizeAll = () => Object.values(charts).forEach((c) => c.resize());
  window.addEventListener('beforeprint', resizeAll);
  window.addEventListener('afterprint', resizeAll);

  window.exportTableToCSV = exportTableToCSV;

  // Wait for DM Sans so canvas text uses it
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => init(false));
})();

/* Exim Bank Social Media Dashboard — prototype
 * Reads data.json. Real public observations render as-is; anything taken from
 * `demoFallbacks` is tagged SIMULATED and can be hidden with the header switch.
 * `null` in the data means "not available", never zero.
 */
(function () {
  'use strict';

  const DATA_URL = 'data.json';

  const C = {
    blue: '#002B5C', blue80: '#33557D', blue60: '#66809D', blue30: '#B3BFCE', blue10: '#E6EAEF',
    gold: '#F5A623', goldDark: '#C98510', gold50: '#FAD291', gold20: '#FDEDD3',
    good: '#1E8E5A', bad: '#C8102E', neutral: '#B3BFCE',
    text: '#1A1A2E', muted: '#5B6578', grid: '#EEF1F5'
  };

  const PLATFORM = {
    facebook: { label: 'Facebook', color: C.blue60 },
    instagram: { label: 'Instagram', color: C.gold },
    youtube: { label: 'YouTube', color: C.goldDark },
    tiktok: { label: 'TikTok', color: C.blue },
    whatsapp: { label: 'WhatsApp', color: C.good },
    website: { label: 'Website', color: C.muted }
  };

  const charts = {};
  const state = { data: null, sim: true, metric: 'rates', showAllPosts: false };

  // ---------- Formatting ----------
  const fmtInt = new Intl.NumberFormat('en-US');
  const fmtCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const num = (v) => (isNum(v) ? fmtInt.format(Math.round(v)) : '—');
  const compact = (v) => (isNum(v) ? fmtCompact.format(v) : '—');
  const pct = (v, d = 1) => (isNum(v) ? (v * 100).toFixed(d) + '%' : '—');
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = (iso, opts) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' }) : null);
  const monthLabel = (ym) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  const safeUrl = (u) => (/^https:\/\//.test(u || '') ? u : null);
  const NA = 'Not publicly available';

  // ---------- Chart.js defaults ----------
  Chart.defaults.font.family = '"DM Sans", system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = C.muted;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: C.blue, titleColor: '#fff', bodyColor: '#fff', footerColor: '#FAD291',
    padding: 10, cornerRadius: 6, boxPadding: 4
  });
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
  Chart.defaults.maintainAspectRatio = false;

  function makeChart(id, config) {
    destroyChart(id);
    const el = document.getElementById(id);
    if (!el) return null;
    charts[id] = new Chart(el, config);
    return charts[id];
  }
  function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }
  // Show an explanatory empty state instead of a chart
  function gate(boxEl, chartId, show, msg) {
    boxEl.classList.toggle('is-empty', !show);
    if (show) boxEl.removeAttribute('data-msg'); else { boxEl.setAttribute('data-msg', msg); destroyChart(chartId); }
    return show;
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
      render();
      if (isRefresh) toast('Dashboard refreshed from data.json');
    } catch (err) {
      console.error(err);
      $('#public-kpis').innerHTML =
        '<div class="error-box" style="grid-column:1/-1">Could not load <code>data.json</code>. ' +
        'Browsers block this when the page is opened straight from disk. Run ' +
        '<code>python3 -m http.server 8000</code> in the project folder and open ' +
        '<code>http://localhost:8000</code>.</div>';
    } finally {
      setTimeout(() => { btn.classList.remove('loading'); btn.disabled = false; }, 400);
    }
  }

  // Simulated values are only used when the data allows it and the switch is on
  function simOn() {
    const f = state.data.demoFallbacks;
    return state.sim && !!(f && f.enabled);
  }
  function fallback() { return state.data.demoFallbacks || {}; }

  function render() {
    const d = state.data;
    document.body.classList.toggle('no-sim', !simOn());

    const updated = new Date(d.lastUpdated);
    $('#last-updated').textContent = updated.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dar_es_Salaam'
    }) + ' EAT';
    $('#period-label').textContent = d.reportingPeriod.label;

    const n = d.dataNotice || {};
    $('#notice-banner').textContent = n.banner || '';
    $('#notice-text').textContent = n.limitations || '';
    $('#sim-label').textContent = (fallback().displayLabel || 'Simulated example figures').replace(/^SIMULATED\s*[—-]\s*/i, '');

    renderPublicKPIs(d);
    renderSimKPIs(d);
    renderAudience(d);
    renderTrend(d);
    renderBenchmarks(d);
    renderPeers(d);
    renderSentiment(d);
    renderOwned(d);
    renderPosts(d);
    renderPostChart(d);
    renderTCRA(d);
    renderChannelTable(d);
    renderRecommendations(d);
    renderSources(d);
  }

  // ---------- Public KPIs (real) ----------
  function renderPublicKPIs(d) {
    const ch = d.channels;
    const tk = ch.tiktok.publicSnapshot || {};
    const cards = [
      { label: 'Facebook followers', value: ch.facebook.followers, sub: ch.facebook.counterPrecision, asOf: ch.facebook.asOf },
      { label: 'Instagram followers', value: ch.instagram.followers, sub: ch.instagram.counterPrecision, asOf: ch.instagram.asOf },
      { label: 'YouTube subscribers', value: ch.youtube.subscribers, sub: isNum(ch.youtube.videoCount) ? `${ch.youtube.videoCount} videos on channel` : '', asOf: ch.youtube.asOf },
      { label: 'TikTok followers', value: isNum(ch.tiktok.followers) ? ch.tiktok.followers : tk.indexedFollowers,
        sub: isNum(tk.profileLikes) ? `${compact(tk.profileLikes)} profile likes` : '',
        flag: isNum(ch.tiktok.followers) ? null : 'Undated search-index value, not verified' }
    ];
    $('#public-kpis').innerHTML = cards.map((c) => `
      <div class="kpi ${isNum(c.value) ? '' : 'unavailable'}">
        <span class="kpi-label">${esc(c.label)}</span>
        <span class="kpi-value" title="${num(c.value)}">${isNum(c.value) ? (c.value < 10000 ? num(c.value) : compact(c.value)) : NA}</span>
        ${c.sub ? `<span class="kpi-sub">${esc(c.sub)}</span>` : ''}
        ${c.flag ? `<span class="kpi-flag">⚠ ${esc(c.flag)}</span>` : `<span class="kpi-sub">As of ${esc(day(c.asOf) || '—')}</span>`}
      </div>`).join('');
  }

  // ---------- Simulated KPIs ----------
  function renderSimKPIs(d) {
    const real = d.summary || {};
    const f = fallback();
    const months = f.monthlyTrend || [];
    const items = [
      { key: 'totalImpressions', label: 'Total impressions', color: C.blue },
      { key: 'totalEngagement', label: 'Total engagement', color: C.gold },
      { key: 'netFollowerGrowth', label: 'Net follower growth', color: C.blue, prefix: '+' },
      { key: 'websiteSessions', label: 'Website sessions', color: C.gold }
    ];
    const useSim = simOn();
    const last = months[months.length - 1], prev = months[months.length - 2];

    $('#sim-kpis').innerHTML = items.map((it) => {
      const realVal = real[it.key];
      const val = isNum(realVal) ? realVal : (useSim ? (f.summary || {})[it.key] : null);
      const isSim = !isNum(realVal) && isNum(val);
      if (!isNum(val)) {
        return `<div class="kpi unavailable"><span class="kpi-label">${it.label}</span>
          <span class="kpi-value">${NA}</span><span class="kpi-sub">Needs authorised analytics export</span></div>`;
      }
      let delta = '';
      if (isSim && last && prev && isNum(last[it.key]) && isNum(prev[it.key])) {
        const chg = (last[it.key] - prev[it.key]) / prev[it.key];
        delta = `<span class="kpi-meta"><span class="delta ${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '▲' : '▼'} ${pct(Math.abs(chg))}</span>Sep vs Aug</span>`;
      }
      return `<div class="kpi ${isSim ? 'sim' : ''}">
        <span class="kpi-label">${it.label}</span>
        <span class="kpi-value" title="${num(val)}">${it.prefix || ''}${compact(val)}</span>
        ${delta || '<span class="kpi-sub">Q3 total</span>'}
        ${isSim ? '<span class="tag tag-sim">Simulated</span>' : ''}
        <div class="kpi-spark"><canvas id="spark-${it.key}"></canvas></div>
      </div>`;
    }).join('');

    if (!useSim) return items.forEach((it) => destroyChart('spark-' + it.key));
    items.forEach((it) => {
      const pts = months.map((m) => m[it.key]);
      if (!pts.every(isNum)) return;
      makeChart('spark-' + it.key, {
        type: 'line',
        data: {
          labels: months.map((m) => monthLabel(m.month)),
          datasets: [{ data: pts, borderColor: it.color, borderWidth: 2, borderDash: [4, 3], pointRadius: 2.5, pointBackgroundColor: it.color, tension: 0.3, fill: true, backgroundColor: hexA(it.color, 0.1) }]
        },
        options: {
          animation: false,
          plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: (c) => num(c.parsed.y) + ' (simulated)' } } },
          scales: { x: { display: false }, y: { display: false } },
          interaction: { intersect: false, mode: 'index' }
        }
      });
    });
  }

  // ---------- Audience mix (real followers) ----------
  function renderAudience(d) {
    const ch = d.channels;
    const rows = [
      ['facebook', ch.facebook.followers], ['instagram', ch.instagram.followers], ['youtube', ch.youtube.subscribers]
    ].filter((r) => isNum(r[1]));
    const total = rows.reduce((a, r) => a + r[1], 0);
    const dates = [ch.facebook.asOf, ch.instagram.asOf, ch.youtube.asOf].filter(Boolean);
    $('#mix-sub').textContent = 'Public follower counters' + (dates.length ? `, observed ${day(dates[0])}` : '');
    $('#mix-note').textContent = 'TikTok is left out: its only follower count is an undated search-index value. Facebook and Instagram counters are rounded as displayed (119K, 38.5K). Followers are not reach or impressions.';
    makeChart('channel-mix', {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => `${PLATFORM[r[0]].label}  ${pct(r[1] / total, r[1] / total < 0.01 ? 1 : 0)}`),
        datasets: [{ data: rows.map((r) => r[1]), backgroundColor: rows.map((r) => PLATFORM[r[0]].color), borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }]
      },
      options: {
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 14 } },
          tooltip: { callbacks: { label: (c) => ` ${PLATFORM[rows[c.dataIndex][0]].label}: ${num(c.parsed)} (${pct(c.parsed / total)})` } }
        }
      },
      plugins: [centerText(() => [compact(total), 'public followers'])]
    });
  }

  // ---------- Monthly trend (simulated) ----------
  function renderTrend(d) {
    const months = fallback().monthlyTrend || [];
    const box = $('#trend-box');
    if (!gate(box, 'engagement-trend', simOn() && months.length > 0,
      'Monthly reach, impressions, engagement and sessions are not publicly disclosed. Turn on simulated figures to preview this chart, or connect Meta, YouTube and GA4 exports.')) {
      $('#trend-sub').textContent = 'July to September 2026';
      return;
    }
    const labels = months.map((m) => monthLabel(m.month));
    const m = state.metric;
    if (m === 'rates') {
      $('#trend-sub').textContent = 'Engagement rate by channel, Jul to Sep 2026 (PRD example figures)';
      const keys = ['tiktok', 'instagram', 'facebook', 'youtube'];
      makeChart('engagement-trend', {
        type: 'line',
        data: {
          labels,
          datasets: keys.map((k) => ({
            label: PLATFORM[k].label, data: months.map((x) => (x.engagementRates || {})[k] ?? null),
            borderColor: PLATFORM[k].color, backgroundColor: PLATFORM[k].color, borderWidth: 2.25, borderDash: [6, 4],
            tension: 0.25, pointRadius: 4, pointHoverRadius: 6
          }))
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', align: 'end' },
            tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${pct(c.parsed.y)}`, footer: () => 'Simulated' } }
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => pct(v, 0) } }
          }
        }
      });
    } else {
      const names = { totalImpressions: 'Impressions', totalEngagement: 'Engagements', websiteSessions: 'Website sessions' };
      $('#trend-sub').textContent = `${names[m]} per month, Jul to Sep 2026 (PRD example figures)`;
      makeChart('engagement-trend', {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: names[m], data: months.map((x) => x[m]), backgroundColor: [C.blue30, C.blue60, C.blue], borderColor: C.gold, borderWidth: { top: 3 }, borderRadius: 4, barPercentage: 0.55 }]
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: { displayColors: false, callbacks: { label: (c) => `${num(c.parsed.y)} ${names[m].toLowerCase()}`, footer: () => 'Simulated' } }
          },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => compact(v) } }
          }
        },
        plugins: [barTopLabels((v) => compact(v))]
      });
    }
  }

  // ---------- Benchmarks (real benchmark, simulated Exim) ----------
  function renderBenchmarks(d) {
    const b = d.benchmarks || {};
    const fc = fallback().channels || {};
    const rows = [
      { label: 'Instagram', bench: b.instagramIndustryAvg, actual: d.channels.instagram.engagementRate, sim: (fc.instagram || {}).engagementRate },
      { label: 'Facebook', bench: b.facebookIndustryAvg, actual: d.channels.facebook.engagementRate, sim: (fc.facebook || {}).engagementRate }
    ];
    const useSim = simOn();
    const [bStart, bEnd] = (b.period || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
    const bPeriod = bStart && bEnd ? `${day(bStart, { day: 'numeric', month: 'short' })} – ${day(bEnd)}` : 'Q2 2026';
    $('#bench-sub').textContent = `Worldwide bank-sector median post engagement rate, ${bPeriod} (Emplifi)`;

    const datasets = [{
      label: 'Bank median (Emplifi, Q2 2026)', data: rows.map((r) => r.bench), backgroundColor: C.blue, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.6
    }];
    if (rows.some((r) => isNum(r.actual))) {
      datasets.push({ label: 'Exim actual', data: rows.map((r) => r.actual), backgroundColor: C.good, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.6 });
    }
    if (useSim) {
      datasets.push({ label: 'Exim (simulated)', data: rows.map((r) => (isNum(r.actual) ? null : r.sim)), backgroundColor: C.gold20, borderColor: C.goldDark, borderWidth: 2, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.6 });
    }
    makeChart('benchmark-chart', {
      type: 'bar',
      data: { labels: rows.map((r) => r.label), datasets },
      options: {
        plugins: {
          legend: { position: 'top', align: 'end' },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${pct(c.parsed.y, 2)}` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: C.text } },
          y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => pct(v, 0) } }
        }
      }
    });

    $('#bench-list').innerHTML = rows.map((r) => {
      if (isNum(r.actual)) {
        const good = r.actual >= r.bench;
        return `<li class="${good ? 'good' : 'bad'}"><span class="b-name">${r.label}</span>
          <span class="b-flag">${good ? '▲ Above' : '▼ Below'}</span>
          <span class="b-vals">Exim ${pct(r.actual, 2)} vs ${pct(r.bench, 2)} median</span></li>`;
      }
      const simTxt = useSim && isNum(r.sim)
        ? ` Simulated PRD figure: ${pct(r.sim, 1)} (${r.sim >= r.bench ? 'above' : 'below'} median).` : '';
      return `<li><span class="b-name">${r.label}: median ${pct(r.bench, 2)}</span>
        <span class="b-flag" style="color:var(--text-muted)">Exim: n/a</span>
        <span class="b-vals">Exim's Q3 rate is ${NA.toLowerCase()}.${simTxt}</span></li>`;
    }).join('');
  }

  // ---------- Peers (real) ----------
  function renderPeers(d) {
    const comps = ((d.publicObservations || {}).competitorSnapshots || []).filter((c) => c.platform === 'instagram' && isNum(c.followers));
    const self = { account: 'Exim Bank Tanzania (@exim_banktz)', followers: d.channels.instagram.followers, asOf: d.channels.instagram.asOf, self: true };
    const rows = [...comps, self].filter((r) => isNum(r.followers)).sort((a, b) => b.followers - a.followers);
    const short = (a) => a.replace(/\s*\(.*\)$/, '').replace(/ Plc$/, '');
    const dates = [...new Set(rows.map((r) => r.asOf).filter(Boolean))];
    $('#peer-sub').textContent = 'Tanzanian banks, public profile counters' + (dates.length === 1 ? `, ${day(dates[0])}` : '');
    const leader = rows[0];
    $('#peer-note').textContent = leader && !leader.self
      ? `${short(leader.account)} has about ${Math.round(leader.followers / self.followers)}x Exim's Instagram audience. Counters are point-in-time snapshots, not Q3-end history.`
      : '';
    makeChart('peer-chart', {
      type: 'bar',
      data: {
        labels: rows.map((r) => short(r.account)),
        datasets: [{ data: rows.map((r) => r.followers), backgroundColor: rows.map((r) => (r.self ? C.gold : C.blue)), borderRadius: 4, barPercentage: 0.7 }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { displayColors: false, callbacks: { title: (i) => rows[i[0].dataIndex].account, label: (c) => `${num(c.parsed.x)} followers` } }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => compact(v) } },
          y: { grid: { display: false }, ticks: { color: C.text, font: { weight: 500 } } }
        }
      },
      plugins: [barEndLabels((v) => compact(v))]
    });
  }

  // ---------- Sentiment (simulated) ----------
  function renderSentiment(d) {
    const real = d.sentiment || {};
    const hasReal = ['positive', 'neutral', 'negative'].every((k) => isNum(real[k]));
    const s = hasReal ? real : (fallback().sentiment || {});
    const box = $('#gauge-box');
    const show = hasReal || (simOn() && isNum(s.positive));
    $('#sentiment-note').textContent = real.note || '';
    if (!gate(box, 'sentiment-gauge', show, 'No authorised comment or message corpus is available, so sentiment is not shown. Turn on simulated figures to preview the gauge.')) {
      $('#sentiment-legend').innerHTML = '';
      return;
    }
    const parts = [
      { k: 'positive', label: 'Positive', color: C.good },
      { k: 'neutral', label: 'Neutral', color: C.neutral },
      { k: 'negative', label: 'Negative', color: C.bad }
    ];
    makeChart('sentiment-gauge', {
      type: 'doughnut',
      data: { labels: parts.map((p) => p.label), datasets: [{ data: parts.map((p) => s[p.k]), backgroundColor: parts.map((p) => p.color), borderColor: '#fff', borderWidth: 3 }] },
      options: {
        rotation: -90, circumference: 180, cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${pct(c.parsed, 0)}`, footer: () => (hasReal ? '' : 'Simulated') } } }
      }
    });
    const net = Math.round((s.positive - s.negative) * 100);
    $('#gauge-center').innerHTML = `<div class="g-val">${net >= 0 ? '+' : ''}${net}</div><div class="g-lbl">Net sentiment${hasReal ? '' : ' (simulated)'}</div>`;
    $('#sentiment-legend').innerHTML = parts.map((p) =>
      `<li><i class="dot" style="background:${p.color}"></i>${p.label} <b>${pct(s[p.k], 0)}</b></li>`).join('');
    if (!hasReal && s.note) $('#sentiment-note').textContent = s.note;
  }

  // ---------- WhatsApp & website ----------
  function renderOwned(d) {
    const wa = d.channels.whatsapp || {}, web = d.channels.website || {};
    const fc = fallback().channels || {};
    const useSim = simOn();
    const pick = (realV, simV) => (isNum(realV) ? { v: realV } : useSim && isNum(simV) ? { v: simV, sim: true } : { v: null });
    const stat = (label, p, fmt) => `<div class="stat"><span>${label}</span>${isNum(p.v) ? `<b>${fmt(p.v)}</b>` : `<b class="na">n/a</b>`}</div>`;
    const fw = fc.whatsapp || {}, fweb = fc.website || {};
    $('#owned-stats').innerHTML = [
      '<div class="stat-group">WhatsApp broadcasts</div>',
      stat('Messages sent', pick(wa.messagesSent, fw.messagesSent), num),
      stat('Delivery rate', pick(wa.deliveryRate, fw.deliveryRate), (v) => pct(v, 0)),
      stat('Read rate', pick(wa.readRate, fw.readRate), (v) => pct(v, 0)),
      '<div class="stat-group">Website (GA4)</div>',
      stat('Sessions', pick(web.sessions, fweb.sessions), num),
      stat('Bounce rate', pick(web.bounceRate, fweb.bounceRate), (v) => pct(v, 0)),
      stat('Conversions', pick(web.conversions, fweb.conversions), num)
    ].join('');
    const notes = [wa.note, web.note].filter(Boolean).join(' ');
    $('#owned-note').textContent = (useSim ? 'Figures shown are PRD example values, not measured results. ' : '') + notes;
  }

  // ---------- Public posts ----------
  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM21.9 7.3c-.1-1.6-.4-3-1.6-4.2S17.6 1.6 16 1.5c-1.6-.1-6.4-.1-8 0-1.6.1-3 .4-4.2 1.6S2.2 5.7 2.1 7.3c-.1 1.6-.1 6.4 0 8s.4 3 1.6 4.2 2.6 1.5 4.2 1.6c1.6.1 6.4.1 8 0 1.6-.1 3-.4 4.2-1.6s1.5-2.6 1.6-4.2c.1-1.6.1-6.4 0-8zM19.8 18c-.3.9-1 1.5-1.9 1.9-1.3.5-4.4.4-5.9.4s-4.6.1-5.9-.4c-.9-.3-1.5-1-1.9-1.9-.5-1.3-.4-4.4-.4-5.9s-.1-4.6.4-5.9c.3-.9 1-1.5 1.9-1.9C7.4 3.8 10.5 3.9 12 3.9s4.6-.1 5.9.4c.9.3 1.5 1 1.9 1.9.5 1.3.4 4.4.4 5.9s.1 4.6-.4 5.9z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21.58 7.19a2.5 2.5 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.5 2.5 0 0 0-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81a2.5 2.5 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.5 2.5 0 0 0 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3L10 15z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.4 7.4 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>'
  };

  function allPosts(d) {
    const po = d.publicObservations || {};
    const posts = [...(po.eximPublicPosts || []), ...(po.tiktokPosts || []).map((p, i) => ({ id: 'tiktok-' + i, ...p }))];
    // Dated posts newest first, undated last
    return posts.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.date ? -1 : 1));
  }

  function counterLine(p) {
    const bits = [];
    if (p.platform === 'youtube') {
      if (isNum(p.views)) bits.push(`${num(p.views)} views`);
    } else if (p.platform === 'facebook') {
      if (isNum(p.reactions)) bits.push(`${num(p.reactions)} reactions`);
      if (isNum(p.shares)) bits.push(`${num(p.shares)} share${p.shares === 1 ? '' : 's'}`);
    } else {
      if (isNum(p.likes)) bits.push(`${num(p.likes)} likes`);
      if (isNum(p.comments)) bits.push(`${num(p.comments)} comments`);
      if (isNum(p.views)) bits.push(`${num(p.views)} views`);
    }
    return bits.length ? bits.join(' · ') : 'Counters not verified';
  }

  function renderPosts(d) {
    const posts = allPosts(d);
    const shown = state.showAllPosts ? posts : posts.slice(0, 6);
    $('#post-grid').innerHTML = shown.map((p) => `
      <button type="button" class="post-card" data-post="${esc(p.id)}" aria-label="Open ${esc(PLATFORM[p.platform].label)} post">
        <div class="post-thumb ${esc(p.platform)}">
          ${ICONS[p.platform] || ''}
          <span class="chan">${esc(PLATFORM[p.platform].label)}</span>
          ${p.platform === 'youtube' && isNum(p.views) ? `<span class="er">${compact(p.views)} views</span>` : ''}
        </div>
        <div class="post-info">
          <span class="post-date">${p.date ? esc(day(p.date)) : 'Date unverified'}</span>
          <p class="post-caption">${esc(p.caption)}</p>
          <div class="post-stats"><span>${esc(counterLine(p))}</span></div>
        </div>
      </button>`).join('');
    const more = $('#posts-more');
    more.hidden = posts.length <= 6;
    more.textContent = state.showAllPosts ? 'Show fewer' : `Show all ${posts.length} posts`;
  }

  function openPost(id) {
    const d = state.data;
    const p = allPosts(d).find((x) => x.id === id);
    if (!p) return;
    const src = (d.sources || []).find((s) => s.id === p.sourceId);
    const stats = [
      ['Likes', p.likes], ['Comments', p.comments], ['Reactions', p.reactions], ['Shares', p.shares], ['Views', p.views]
    ].filter((s) => p[s[0].toLowerCase()] !== undefined);
    const url = safeUrl(p.url);
    $('#modal-body').innerHTML = `
      <div class="modal-grid">
        <div class="post-thumb ${esc(p.platform)}">${ICONS[p.platform] || ''}</div>
        <div class="modal-content">
          <span class="meta">${esc(PLATFORM[p.platform].label)} · ${p.date ? esc(day(p.date, { day: 'numeric', month: 'long', year: 'numeric' })) : 'Date unverified'}</span>
          <h3 id="modal-title">${esc(src ? src.title : p.caption)}</h3>
          <p>${esc(p.caption)}</p>
          <div class="modal-stats">
            ${stats.map(([k, v]) => `<div><span>${k}</span><b>${isNum(v) ? num(v) : 'n/a'}</b></div>`).join('')}
          </div>
          <div class="modal-note">${esc(p.dateEvidence || (src && src.dateOrPeriod) || 'Counters observed when checked.')} Public counters are not reach, impressions or a full engagement rate.</div>
          ${url ? `<a class="btn btn-gold modal-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">View original post ↗</a>` : ''}
        </div>
      </div>`;
    const modal = $('#post-modal');
    modal.hidden = false;
    modal.querySelector('.modal-close').focus();
  }
  function closeModal() { $('#post-modal').hidden = true; }

  // ---------- Post interactions chart (real) ----------
  function renderPostChart(d) {
    const posts = allPosts(d)
      .filter((p) => p.date && (p.platform === 'instagram' || p.platform === 'facebook'))
      .map((p) => ({ p, v: p.platform === 'instagram' ? (p.likes || 0) + (p.comments || 0) : (p.reactions || 0) + (p.shares || 0) }))
      .sort((a, b) => a.p.date.localeCompare(b.p.date));
    const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
    const yt = allPosts(d).find((p) => p.platform === 'youtube' && isNum(p.views));
    $('#post-chart-note').textContent = `Sample of ${posts.length} dated Q3 posts, not every post published. Counters were read on 1 Oct 2026, so older posts had longer to collect interactions.` +
      (yt ? ` Not plotted: the ${day(yt.date, { day: 'numeric', month: 'short' })} YouTube video (${num(yt.views)} views) is a different counter type.` : '');
    makeChart('post-chart', {
      type: 'bar',
      data: {
        labels: posts.map((x) => `${day(x.p.date, { day: 'numeric', month: 'short' })} · ${trunc(x.p.caption, 28)}`),
        datasets: [{ data: posts.map((x) => x.v), backgroundColor: posts.map((x) => PLATFORM[x.p.platform].color), borderRadius: 3, barPercentage: 0.75 }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { displayColors: false, callbacks: { title: (i) => posts[i[0].dataIndex].p.caption, label: (c) => `${PLATFORM[posts[c.dataIndex].p.platform].label}: ${counterLine(posts[c.dataIndex].p)}` } }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: C.grid }, border: { display: false } },
          y: { grid: { display: false }, ticks: { color: C.text, font: { size: 11 } } }
        }
      },
      plugins: [barEndLabels((v) => num(v))]
    });
  }

  // ---------- TCRA market context (real) ----------
  function renderTCRA(d) {
    const t = (d.publicObservations || {}).tanzaniaMarketContext || {};
    const usage = Object.entries(t.ottSocialPlatformDataUsageGb || {}).sort((a, b) => b[1] - a[1]);
    $('#tcra-sub').textContent = `TCRA, ${t.period || ''}`;
    $('#tcra-stats').innerHTML = `
      <div class="stat"><span>Internet subscriptions</span><b>${compact(t.internetSubscriptions)}</b></div>
      <div class="stat"><span>Internet penetration</span><b>${isNum(t.internetPenetrationPercent) ? t.internetPenetrationPercent + '%' : 'n/a'}</b></div>`;
    $('#tcra-note').textContent = t.unitWarning || '';
    makeChart('tcra-chart', {
      type: 'bar',
      data: {
        labels: usage.map((u) => (PLATFORM[u[0]] || { label: u[0] }).label),
        datasets: [{ data: usage.map((u) => u[1]), backgroundColor: usage.map((u, i) => (i === 0 ? C.blue : i === 1 ? C.gold : C.blue60)), borderRadius: 4, barPercentage: 0.7 }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { displayColors: false, callbacks: { label: (c) => `${num(c.parsed.x)} GB of data used` } } },
        scales: {
          x: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { callback: (v) => compact(v) + ' GB' } },
          y: { grid: { display: false }, ticks: { color: C.text } }
        }
      },
      plugins: [barEndLabels((v) => compact(v) + ' GB')]
    });
  }

  // ---------- Channel table ----------
  function renderChannelTable(d) {
    const ch = d.channels, b = d.benchmarks || {}, fc = fallback().channels || {};
    const useSim = simOn();
    const tk = ch.tiktok.publicSnapshot || {};
    const rows = [
      { k: 'facebook', pub: ch.facebook.followers, asOf: ch.facebook.asOf, note: ch.facebook.counterPrecision, er: ch.facebook.engagementRate, bench: b.facebookIndustryAvg, simF: (fc.facebook || {}).followers, simER: (fc.facebook || {}).engagementRate },
      { k: 'instagram', pub: ch.instagram.followers, asOf: ch.instagram.asOf, note: ch.instagram.counterPrecision, er: ch.instagram.engagementRate, bench: b.instagramIndustryAvg, simF: (fc.instagram || {}).followers, simER: (fc.instagram || {}).engagementRate },
      { k: 'youtube', pub: ch.youtube.subscribers, asOf: ch.youtube.asOf, note: isNum(ch.youtube.videoCount) ? `${ch.youtube.videoCount} videos` : '', er: null, bench: null, simF: (fc.youtube || {}).subscribers, simER: null },
      { k: 'tiktok', pub: isNum(ch.tiktok.followers) ? ch.tiktok.followers : tk.indexedFollowers, asOf: tk.asOf, note: isNum(ch.tiktok.followers) ? '' : 'Undated search-index value', er: ch.tiktok.engagementRate, bench: null, simF: (fc.tiktok || {}).followers, simER: (fc.tiktok || {}).engagementRate }
    ];
    const cell = (v, fmt, cls = '') => `<td class="num ${cls} ${isNum(v) ? '' : 'na'}">${isNum(v) ? fmt(v) : 'n/a'}</td>`;
    const simHead = useSim ? '<th class="num simcol">Simulated followers</th><th class="num simcol">Simulated eng. rate</th>' : '';
    $('#channel-table').innerHTML = `<thead><tr>
      <th>Channel</th><th class="num">Public followers</th><th>As of</th><th>Note</th>
      <th class="num">Exim eng. rate</th><th class="num">Bank median (Q2)</th>${simHead}
    </tr></thead><tbody>${rows.map((r) => `<tr>
      <td><span class="chan-dot" style="background:${PLATFORM[r.k].color}"></span>${PLATFORM[r.k].label}</td>
      ${cell(r.pub, num)}
      <td>${r.asOf ? esc(day(r.asOf)) : '<span class="na">Undated</span>'}</td>
      <td>${esc(r.note || '')}</td>
      ${cell(r.er, (v) => pct(v))}
      ${cell(r.bench, (v) => pct(v, 2))}
      ${useSim ? cell(r.simF, num, 'simcol') + cell(r.simER, (v) => pct(v), 'simcol') : ''}
    </tr>`).join('')}</tbody>`;
  }

  // ---------- Recommendations ----------
  const REC_ICONS = [
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 0 1 0 6.2h-4V17h4a5 5 0 0 0 0-10z"/></svg>',
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>',
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21.58 7.19a2.5 2.5 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.5 2.5 0 0 0-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81a2.5 2.5 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.5 2.5 0 0 0 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3L10 15z"/></svg>',
    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
  ];
  function renderRecommendations(d) {
    $('#rec-grid').innerHTML = (d.recommendations || []).map((r, i) => {
      const pr = String(r.priority || 'medium').toLowerCase();
      return `<article class="rec">
        <div class="rec-top">
          <span class="rec-icon">${REC_ICONS[i % REC_ICONS.length]}</span>
          <span class="badge ${esc(pr)}">${esc(pr)} priority</span>
        </div>
        <p>${esc(r.text)}</p>
      </article>`;
    }).join('');
  }

  // ---------- Sources ----------
  function renderSources(d) {
    const src = d.sources || [];
    $('#sources-sub').textContent = `${src.length} sources reviewed. Last checked ${day((d.lastUpdated || '').slice(0, 10))}.`;
    $('#quality-notes').innerHTML = (d.dataQualityNotes || []).map((n) => `<li>${esc(n)}</li>`).join('');
    $('#sources-table').innerHTML = `<thead><tr><th>Source</th><th>Date / period</th><th>Supports</th></tr></thead><tbody>${src.map((s) => {
      const url = safeUrl(s.url);
      return `<tr>
        <td>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : esc(s.title)}<br><span class="na">${esc(s.publisher)}</span></td>
        <td>${esc(s.dateOrPeriod)}</td>
        <td>${esc(s.supports)}</td>
      </tr>`;
    }).join('')}</tbody>`;
  }

  // ---------- CSV export ----------
  function tableToRows(tableId) {
    const table = document.getElementById(tableId);
    return [...table.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((cell) => cell.textContent.replace(/\s+/g, ' ').trim()));
  }
  function toCSV(rows) {
    return rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(',')).join('\r\n');
  }
  function download(filename, text) {
    const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stamp = () => (state.data ? state.data.reportingPeriod.end : new Date().toISOString().slice(0, 10));

  function exportTableToCSV(tableId) {
    const rows = tableToRows(tableId);
    if (tableId === 'sources-table') {
      rows[0].push('URL');
      (state.data.sources || []).forEach((s, i) => rows[i + 1] && rows[i + 1].push(s.url || ''));
    }
    download(`exim-${tableId}-${stamp()}.csv`, toCSV(rows));
    toast('CSV downloaded');
  }

  function exportAllCSV() {
    const d = state.data, f = fallback();
    const v = (x) => (isNum(x) ? String(x) : '');
    const out = [
      ['Exim Bank Social Media Dashboard'], ['Period', d.reportingPeriod.label], ['Data notice', (d.dataNotice || {}).banner || ''],
      ['Generated', new Date().toISOString()], [],
      ['PUBLIC POSTS (public data)'], ['Date', 'Platform', 'Caption', 'Likes', 'Comments', 'Reactions', 'Shares', 'Views', 'URL']
    ];
    allPosts(d).forEach((p) => out.push([p.date || 'unverified', p.platform, p.caption, v(p.likes), v(p.comments), v(p.reactions), v(p.shares), v(p.views), p.url || '']));
    out.push([], ['CHANNEL OVERVIEW'], ...tableToRows('channel-table'));
    out.push([], ['INSTAGRAM PEERS (public data)'], ['Account', 'Followers', 'As of']);
    ((d.publicObservations || {}).competitorSnapshots || []).forEach((c) => out.push([c.account, v(c.followers), c.asOf || '']));
    out.push(['Exim Bank Tanzania (@exim_banktz)', v(d.channels.instagram.followers), d.channels.instagram.asOf || '']);
    out.push([], ['BENCHMARKS (public data)'], ['Metric', 'Value', 'Period', 'Source'],
      ['Instagram bank median engagement rate', v(d.benchmarks.instagramIndustryAvg), d.benchmarks.period || '', 'Emplifi'],
      ['Facebook bank median engagement rate', v(d.benchmarks.facebookIndustryAvg), d.benchmarks.period || '', 'Emplifi']);
    if (simOn()) {
      out.push([], ['SIMULATED FIGURES: ' + (f.displayLabel || '')], ['Month', 'Impressions', 'Engagement', 'Net follower growth', 'Website sessions', 'Conversions']);
      (f.monthlyTrend || []).forEach((m) => out.push([m.month, v(m.totalImpressions), v(m.totalEngagement), v(m.netFollowerGrowth), v(m.websiteSessions), v(m.conversions)]));
      const s = f.summary || {};
      out.push(['Q3 total', v(s.totalImpressions), v(s.totalEngagement), v(s.netFollowerGrowth), v(s.websiteSessions), v(s.conversions)]);
    }
    out.push([], ['SOURCES'], ['Title', 'Publisher', 'Date / period', 'URL']);
    (d.sources || []).forEach((s) => out.push([s.title, s.publisher, s.dateOrPeriod, s.url]));
    download(`exim-social-report-${stamp()}.csv`, toCSV(out));
    toast('Full report CSV downloaded');
  }

  // ---------- Chart helpers ----------
  function centerText(getLines) {
    return {
      id: 'centerText',
      afterDraw(chart) {
        const meta = chart.getDatasetMeta(0).data[0];
        if (!meta) return;
        const { ctx } = chart;
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
        const { ctx, chartArea } = chart;
        const ds = chart.data.datasets[0];
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          const label = fmt(ds.data[i]);
          ctx.save();
          ctx.font = '700 11.5px "DM Sans", sans-serif';
          const w = ctx.measureText(label).width;
          const fitsOutside = bar.x + w + 8 < chartArea.right;
          const bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
          ctx.fillStyle = fitsOutside ? C.text : (bg === C.gold ? C.blue : '#fff');
          ctx.textAlign = fitsOutside ? 'left' : 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, fitsOutside ? bar.x + 6 : bar.x - 6, bar.y);
          ctx.restore();
        });
      }
    };
  }
  function barTopLabels(fmt) {
    return {
      id: 'barTopLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const ds = chart.data.datasets[0];
        chart.getDatasetMeta(0).data.forEach((bar, i) => {
          ctx.save();
          ctx.font = '700 12px "DM Sans", sans-serif';
          ctx.fillStyle = C.text;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(fmt(ds.data[i]), bar.x, bar.y - 6);
          ctx.restore();
        });
      }
    };
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

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
    const metric = e.target.closest('[data-metric]');
    if (metric && state.data) {
      state.metric = metric.dataset.metric;
      document.querySelectorAll('[data-metric]').forEach((b) => b.classList.toggle('active', b === metric));
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

  $('#posts-more').addEventListener('click', () => { state.showAllPosts = !state.showAllPosts; renderPosts(state.data); });
  $('#sim-toggle').addEventListener('change', (e) => {
    state.sim = e.target.checked;
    try { localStorage.setItem('exim-sim', state.sim ? '1' : '0'); } catch (_) { /* storage unavailable */ }
    if (state.data) render();
    toast(state.sim ? 'Showing simulated figures (labelled)' : 'Showing public data only');
  });
  $('#refresh-btn').addEventListener('click', () => init(true));
  $('#export-csv').addEventListener('click', () => state.data && exportAllCSV());
  $('#export-print').addEventListener('click', () => window.print());
  $('#export-pdf').addEventListener('click', () => {
    toast('Choose "Save as PDF" as the destination');
    setTimeout(() => window.print(), 600);
  });

  const resizeAll = () => Object.values(charts).forEach((c) => c.resize());
  window.addEventListener('beforeprint', resizeAll);
  window.addEventListener('afterprint', resizeAll);
  window.exportTableToCSV = exportTableToCSV;

  // ?view=public forces public-only; otherwise remember the viewer's last choice
  try {
    const q = new URLSearchParams(location.search).get('view');
    const saved = localStorage.getItem('exim-sim');
    if (q === 'public') state.sim = false;
    else if (q === 'demo') state.sim = true;
    else if (saved !== null) state.sim = saved === '1';
  } catch (_) { /* storage unavailable */ }
  $('#sim-toggle').checked = state.sim;

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => init(false));
})();

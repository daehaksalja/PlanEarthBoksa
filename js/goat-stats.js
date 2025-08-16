// js/goat-stats.js
(() => {
  const $  = (s) => document.querySelector(s);
  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  const setHTML = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
  const fmt = (n) => (n == null ? '-' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','));

  // 기간 버튼
  const periods = [7, 30, 90];
  const url = new URL(location.href);
  let days = Number(url.searchParams.get('d')) || 30;
  if (!periods.includes(days)) days = 30;

  periods.forEach(d => {
    const b = document.querySelector(`[data-days="${d}"]`);
    if (!b) return;
    b.classList.toggle('active', d === days);
    b.addEventListener('click', () => {
      const u = new URL(location.href);
      u.searchParams.set('d', String(d));
      location.assign(u.toString());
    });
  });

  const toDateStr = (d) => d.toISOString().slice(0, 10);
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  // 프록시 호출
  const qs = (obj) => new URLSearchParams(obj).toString();
  async function gc(path) {
    const r = await fetch('/api/goat-proxy?path=' + encodeURIComponent(path), { cache: 'no-store' });
    const text = await r.text();
    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
    try { return JSON.parse(text); } catch { throw new Error(text); }
  }

  // 일별 시계열 뽑기(필드 다양성 대응)
  function extractSeries(totals) {
    // 1) { stats: [{ daily, day, hourly:[] }...] }
    if (Array.isArray(totals?.stats)) return totals.stats.map(d => d?.daily ?? 0);
    // 2) { days: [{ count, day }...] }
    if (Array.isArray(totals?.days))  return totals.days.map(d => d?.count ?? 0);
    // 3) { daily: [n, n, ...] }
    if (Array.isArray(totals?.daily)) return totals.daily.map(n => n ?? 0);
    return [];
  }

  // 스파크라인
  function drawSpark(sel, data) {
    const host = $(sel);
    if (!host) return;
    let w = host.clientWidth;
    if (!w) { w = (host.getBoundingClientRect().width || 360); }
    const h = 64, pad = 6;
    const max = Math.max(1, ...data);
    const pts = data.map((v, i) => {
      const x = pad + (i * (w - 2 * pad)) / Math.max(1, data.length - 1);
      const y = h - pad - (v / max) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(' ');
    setHTML(sel, `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <polyline fill="none" stroke="#13e7a1" stroke-width="2" points="${pts}"/>
      </svg>
    `);
  }

  (async function run() {
    try {
      const from = toDateStr(start);
      const to   = toDateStr(end);

      // 총합 + 일별
      const totals = await gc(`/api/v0/stats/total?${qs({ from, to })}`);
      // 상위 페이지
      const hits   = await gc(`/api/v0/stats/hits?${qs({ from, to, limit: 20, order: 'count:desc' })}`);

      // 디버그
      setText('#raw', JSON.stringify({ totals, hits }, null, 2));

      // 시계열, 합계/평균/피크
      const series = extractSeries(totals);
      const sum = series.reduce((a,b)=>a+(+b||0), 0);

      const totalCount =
        typeof totals.total === 'number' ? totals.total :
        typeof totals.total_utc === 'number' ? totals.total_utc :
        typeof totals.count === 'number' ? totals.count : sum;

      const avg  = series.length ? Math.round(sum / series.length) : 0;
      const peak = series.length ? Math.max(...series) : 0;

      // unique(있으면 표시)
      const unique =
        (typeof totals.unique === 'number' && totals.unique) ??
        (typeof totals.total?.unique === 'number' && totals.total.unique) ??
        null;

      setText('#total', fmt(totalCount));
      if (document.querySelector('#unique')) setText('#unique', unique == null ? '-' : fmt(unique));
      if (document.querySelector('#avg'))    setText('#avg', fmt(avg));
      if (document.querySelector('#peak'))   setText('#peak', fmt(peak));
      drawSpark('#spark', series.slice(-30));

      // 상위 페이지
      const list =
        (hits && (hits.hits?.data || hits.hits || hits.data)) ||
        (Array.isArray(hits) ? hits : []);
      if (!list.length) {
        setText('#top-pages', '데이터 없음');
      } else {
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        list.slice(0, 20).forEach((row, i) => {
          const path  = row.path || row.name || row[0] || '';
          const count = row.count ?? row.views ?? row[1] ?? 0;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="padding:8px 6px; color:#9feccf; width:36px">${i + 1}</td>
            <td style="padding:8px 6px;">${path}</td>
            <td style="padding:8px 6px; text-align:right; color:#bfffe7; width:120px">${fmt(count)}</td>
          `;
          table.appendChild(tr);
        });
        const box = $('#top-pages'); if (box) { box.innerHTML = ''; box.appendChild(table); }
      }
    } catch (err) {
      setText('#raw', '오류: ' + (err?.message || err));
      setText('#top-pages', '데이터 로드 실패');
      ['#total','#avg','#peak','#unique'].forEach(id => { if ($(id)) setText(id, '-'); });
    }
  })();
})();

// js/goat-stats.js
(() => {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  const setHTML = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };

  const fmt = (n) => (n == null ? '-' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','));

  // 기간 버튼
  const periods = [7, 30, 90];
  const url = new URL(location.href);
  let days = Number(url.searchParams.get('d')) || 30;
  if (!periods.includes(days)) days = 30;

  // 버튼 active
  periods.forEach(d => {
    const b = $(`[data-days="${d}"]`);
    if (b) b.classList.toggle('active', d === days);
    if (b) b.addEventListener('click', () => {
      const u = new URL(location.href);
      u.searchParams.set('d', String(d));
      location.assign(u.toString());
    });
  });

  // YYYY-MM-DD
  const toDateStr = (d) => d.toISOString().slice(0, 10);

  // 기간 계산(오늘 포함)
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1)); // N일 구간

  // 서버 프록시 호출 헬퍼 (/api/goat-proxy?path=...)
  const qs = (obj) => new URLSearchParams(obj).toString();
  const gc = async (path) => {
    const r = await fetch('/api/goat-proxy?path=' + encodeURIComponent(path), { cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };

  // 스파크라인 렌더
  const drawSpark = (sel, data) => {
    const host = $(sel);
    if (!host) return;
    const w = host.clientWidth || 360;
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
  };

  // 메인 로직
  (async function run() {
    try {
      const from = toDateStr(start);
      const to   = toDateStr(end);

      // 1) 총합 + 일별
      const totals = await gc(`/api/v0/stats/total?${qs({ from, to })}`);

      // 2) 상위 페이지
      const hits = await gc(`/api/v0/stats/hits?${qs({ from, to, limit: 20, order: 'count:desc' })}`);

      // ── 디버그(raw) ─────────────────────────────────────────
      setText('#raw', JSON.stringify({ totals, hits }, null, 2));

      // ── 카드: 총 방문수 / 평균 / 피크 / 스파크라인 ─────────
      const series = (totals.stats || []).map(d => d.daily || 0);
      const totalCount = (typeof totals.total === 'number') ? totals.total
                        : (typeof totals.total_utc === 'number') ? totals.total_utc
                        : (typeof totals.count === 'number') ? totals.count
                        : series.reduce((a,b)=>a+b,0);

      const avg = series.length ? Math.round(series.reduce((a,b)=>a+b,0) / series.length) : 0;
      const peak = series.length ? Math.max(...series) : 0;

      setText('#total', fmt(totalCount));
      setText('#avg', fmt(avg));
      setText('#peak', fmt(peak));
      drawSpark('#spark', series.slice(-30));

      // ── 상위 페이지 테이블 ────────────────────────────────
      const list = (hits && (hits.hits?.data || hits.hits || hits.data)) || (Array.isArray(hits) ? hits : []);
      if (!list.length) {
        setText('#top-pages', '데이터 없음');
      } else {
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        list.slice(0, 20).forEach((row, i) => {
          const path = row.path || row.name || row[0] || '';
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
      setText('#total', '-'); setText('#avg', '-'); setText('#peak', '-');
    }
  })();
})();

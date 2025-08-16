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

  periods.forEach(d => {
    const b = $(`[data-days="${d}"]`);
    if (b) b.classList.toggle('active', d === days);
    if (b) b.addEventListener('click', () => {
      const u = new URL(location.href);
      u.searchParams.set('d', String(d));
      location.assign(u.toString());
    });
  });

  // 날짜 문자열 (YYYY-MM-DD)
  const toDateStr = (d) => d.toISOString().slice(0,10);

  // 기간 계산(오늘 포함)
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  // 서버 프록시 호출: path 는 "경로만", params 는 쿼리
  const gc = async (path, params = {}) => {
    const sp = new URLSearchParams(params).toString();
    const api = '/api/goat-proxy?path=' + encodeURIComponent(path) + (sp ? '&' + sp : '');
    const r = await fetch(api, { cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };

  // 스파크라인
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

  // 공통 테이블 렌더
  const renderTable = (boxSel, rows, pathKey='path', countKey='count') => {
    const box = $(boxSel);
    if (!box) return;
    if (!rows?.length) {
      box.textContent = '데이터 없음';
      return;
    }
    const tbl = document.createElement('table');
    tbl.style.width = '100%';
    tbl.style.borderCollapse = 'collapse';
    rows.forEach((row, i) => {
      const path  = row[pathKey] ?? row.name ?? row[0] ?? '';
      const count = row[countKey] ?? row.views ?? row[1] ?? 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:8px 6px; color:#9feccf; width:36px">${i + 1}</td>
        <td style="padding:8px 6px;">${path}</td>
        <td style="padding:8px 6px; text-align:right; color:#bfffe7; width:120px">${fmt(count)}</td>
      `;
      tbl.appendChild(tr);
    });
    box.innerHTML = '';
    box.appendChild(tbl);
  };

  (async function run() {
    try {
      const from = toDateStr(start);
      const to   = toDateStr(end);

      // 1) 총합 + 일별
      const totals = await gc('/stats/total', { start: from, end: to });

      // 2) 상위 페이지
      const hits = await gc('/stats/hits', { start: from, end: to, limit: 20, order: 'count:desc' });

      // 3) 리퍼러
      const refs = await gc('/stats/referrers', { start: from, end: to, limit: 20 });

      // 4) 국가/지역
      const countries = await gc('/stats/countries', { start: from, end: to, limit: 20 });

      // 디버그
      setText('#raw', JSON.stringify({ totals, hits, refs, countries }, null, 2));

      // 카드 계산
      const series = (totals.stats || []).map(d => d.daily || 0);
      const totalCount =
        typeof totals.total === 'number' ? totals.total :
        typeof totals.total_utc === 'number' ? totals.total_utc :
        typeof totals.count === 'number' ? totals.count :
        series.reduce((a,b)=>a+b, 0);

      const avg  = series.length ? Math.round(series.reduce((a,b)=>a+b,0) / series.length) : 0;
      const peak = series.length ? Math.max(...series) : 0;

      setText('#total', fmt(totalCount));
      setText('#avg',   fmt(avg));
      setText('#peak',  fmt(peak));
      drawSpark('#spark', series.slice(-30));

      // 표 렌더
      const hitsRows = (hits?.hits?.data || hits?.hits || hits?.data || (Array.isArray(hits) ? hits : [])) ?? [];
      renderTable('#top-pages', hitsRows, 'path', 'count');

      const refRows = (refs?.hits?.data || refs?.hits || refs?.data || (Array.isArray(refs) ? refs : [])) ?? [];
      renderTable('#top-referrers', refRows, 'path', 'count');

      const ctrRows = (countries?.hits?.data || countries?.hits || countries?.data || (Array.isArray(countries) ? countries : [])) ?? [];
      renderTable('#top-countries', ctrRows, 'country', 'count');
    } catch (err) {
      setText('#raw', `오류: ${err?.message || err}`);
      setText('#top-pages', '데이터 로드 실패');
      setText('#top-referrers', '데이터 로드 실패');
      setText('#top-countries', '데이터 로드 실패');
      setText('#total', '-'); setText('#avg', '-'); setText('#peak', '-');
    }
  })();
})();

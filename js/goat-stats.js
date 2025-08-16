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
    if (b) b.classList.toggle('active', d === days);
    if (b) b.addEventListener('click', () => {
      const u = new URL(location.href);
      u.searchParams.set('d', String(d));
      location.assign(u.toString());
    });
  });

  // 날짜(YYYY-MM-DD)
  const toDateStr = (d) => d.toISOString().slice(0, 10);

  // 기간 계산(오늘 포함)
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1)); // N일

  // 프록시 헬퍼 (/api/goat-proxy?path=...)
  const qs = (obj) => new URLSearchParams(obj).toString();
  const gc = async (path) => {
    const r = await fetch('/api/goat-proxy?path=' + encodeURIComponent(path), { cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };

  // 공통 테이블 렌더러
  function renderTable(rows, containerSel, cols) {
    const box = $(containerSel);
    if (!box) return;
    if (!rows.length) { box.textContent = '데이터 없음'; return; }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      const values = cols(row, i);
      tr.innerHTML = values.map(v => `<td style="padding:8px 6px;${v.right ? 'text-align:right; color:#bfffe7; width:120px' : ''}">${v.text}</td>`).join('');
      table.appendChild(tr);
    });

    box.innerHTML = '';
    box.appendChild(table);
  }

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

  (async function run() {
    try {
      const startStr = toDateStr(start);
      const endStr   = toDateStr(end);

      // /stats API는 start, end 사용
      const [totals, hits, referrers, countries] = await Promise.all([
        gc(`/stats/total?${qs({ start: startStr, end: endStr })}`),
        gc(`/stats/hits?${qs({ start: startStr, end: endStr, limit: 20 })}`),
        gc(`/stats/referrers?${qs({ start: startStr, end: endStr, limit: 20 })}`),
        gc(`/stats/countries?${qs({ start: startStr, end: endStr, limit: 20 })}`),
      ]);

      // 디버그
      setText('#raw', JSON.stringify({ totals, hits, referrers, countries }, null, 2));

      // 합계/평균/피크 + 스파크
      const series = Array.isArray(totals?.stats) ? totals.stats.map(d => d.daily ?? d.count ?? 0) : [];
      const totalCount =
        typeof totals?.total === 'number' ? totals.total :
        typeof totals?.total_utc === 'number' ? totals.total_utc :
        typeof totals?.count === 'number' ? totals.count :
        series.reduce((a,b)=>a+b,0);

      const avg  = series.length ? Math.round(series.reduce((a,b)=>a+b,0) / series.length) : 0;
      const peak = series.length ? Math.max(...series) : 0;

      setText('#total', fmt(totalCount));
      setText('#avg',   fmt(avg));
      setText('#peak',  fmt(peak));
      drawSpark('#spark', series.slice(-30));

      // 상위 페이지
      const pages = (hits?.data || hits?.hits || Array.isArray(hits) && hits) || [];
      renderTable(
        pages.slice(0, 20),
        '#top-pages',
        (row, i) => {
          const path  = row.path ?? row.name ?? row[0] ?? '';
          const count = row.count ?? row.views ?? row[1] ?? 0;
          return [
            { text: String(i + 1) },
            { text: path },
            { text: fmt(count), right: true },
          ];
        }
      );

      // 상위 유입
      const refs = (referrers?.data || referrers?.refs || Array.isArray(referrers) && referrers) || [];
      renderTable(
        refs.slice(0, 20),
        '#top-referrers',
        (row, i) => {
          const name  = row.name ?? row.ref ?? row[0] ?? '';
          const count = row.count ?? row.views ?? row[1] ?? 0;
          return [
            { text: String(i + 1) },
            { text: name },
            { text: fmt(count), right: true },
          ];
        }
      );

      // 국가
      const ctys = (countries?.data || countries?.countries || Array.isArray(countries) && countries) || [];
      renderTable(
        ctys.slice(0, 20),
        '#top-countries',
        (row, i) => {
          const name  = row.name ?? row.country ?? row[0] ?? '';
          const count = row.count ?? row.views ?? row[1] ?? 0;
          return [
            { text: String(i + 1) },
            { text: name },
            { text: fmt(count), right: true },
          ];
        }
      );

    } catch (err) {
      setText('#raw', `오류: ${err?.message || err}`);
      setText('#top-pages',     '데이터 로드 실패');
      setText('#top-referrers', '데이터 로드 실패');
      setText('#top-countries', '데이터 로드 실패');
      setText('#total', '-'); setText('#avg', '-'); setText('#peak', '-');
    }
  })();
})();

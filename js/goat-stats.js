(async function () {
  const elTotal  = document.getElementById('total');
  const elUnique = document.getElementById('unique');
  const elTop    = document.getElementById('top-pages');
  const elRaw    = document.getElementById('raw');
  const elSpark  = document.getElementById('spark');

  const fmt = n => n == null ? '-' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // GoatCounter 프록시 호출 헬퍼
  async function gc(pathAndQuery) {
    // pathAndQuery 는 '/stats/total' 또는 '/stats/hits?limit=50' 형태
    const r = await fetch('/api/goat-proxy?path=' + encodeURIComponent(pathAndQuery), { cache: 'no-store' });
    const txt = await r.text();
    if (!r.ok) throw new Error(txt);
    try { return JSON.parse(txt); }
    catch { throw new Error('Proxy returned non-JSON: ' + txt.slice(0, 400)); }
  }

  try {
    // 총계 + 상위 페이지를 병렬 조회
    const [totals, hits] = await Promise.all([
      gc('/stats/total'),         // { total, stats: [{ day, daily, hourly }, ...] }
      gc('/stats/hits?limit=50')  // 형식은 설치/버전에 따라 다를 수 있어 방어적으로 처리
    ]);

    // 디버그 표시
    elRaw.textContent = JSON.stringify({ totals, hits }, null, 2);

    // 총 방문수
    elTotal.textContent = fmt(totals.total ?? 0);

    // unique 수는 이 엔드포인트 기본 JSON엔 없음 → 필요 시 다른 API 조합
    elUnique.textContent = '-';

    // 상위 페이지 표
    let rows = hits.hits?.data ?? hits.hits ?? hits.data ?? hits;
    if (!Array.isArray(rows)) rows = [];

    // [path, count] 또는 {path, count} 모두 흡수
    const normalized = rows.map(it =>
      Array.isArray(it) ? { path: it[0], count: it[1] } :
      { path: it.path ?? it.name ?? '', count: it.count ?? it.views ?? 0 }
    );
    const top = normalized.slice(0, 20);

    if (!top.length) {
      elTop.textContent = '데이터 없음';
    } else {
      const table = document.createElement('table');
      table.style.width = '100%'; table.style.borderCollapse = 'collapse';
      top.forEach((p, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td style="padding:8px 6px; color:#9feccf; width:36px">${i + 1}</td>
           <td style="padding:8px 6px;">${p.path}</td>
           <td style="padding:8px 6px; text-align:right; color:#bfffe7; width:120px">${fmt(p.count)}</td>`;
        table.appendChild(tr);
      });
      elTop.innerHTML = '';
      elTop.appendChild(table);
    }

    // 스파크라인: totals.stats[].daily 사용
    const dailyArr = Array.isArray(totals.stats)
      ? totals.stats.map(d => ({ date: d.day, count: d.daily ?? 0 }))
      : [];
    const last30 = dailyArr.slice(-30);

    if (last30.length) {
      const max = Math.max(...last30.map(d => d.count), 1);
      const w = 420, h = 64, pad = 4;
      const pts = last30.map((d, idx) => {
        const x = pad + (idx * (w - 2 * pad) / (last30.length - 1 || 1));
        const y = h - pad - (d.count / max) * (h - 2 * pad);
        return `${x},${y}`;
      }).join(' ');
      elSpark.innerHTML =
        `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
           <polyline fill="none" stroke="#13e7a1" stroke-width="2" points="${pts}"/>
         </svg>`;
    }
  } catch (err) {
    elRaw.textContent = '오류: ' + err.message;
    elTop.textContent = '데이터 로드 실패';
    elTotal.textContent = '-';
    elUnique.textContent = '-';
  }
})();

// ...위쪽 동일
  try {
    // 최근 30일 기준으로 조회
    const HITS_QS   = '/stats/hits?from=-30d&limit=50';
    const TOTAL_QS  = '/stats/total?from=-30d';

    const [totals, hits] = await Promise.all([
      gc(TOTAL_QS),
      gc(HITS_QS)
    ]);

    // 디버그 보기
    elRaw.textContent = JSON.stringify({ totals, hits }, null, 2);

    // 총 방문수
    elTotal.textContent = fmt(totals.total ?? 0);

    // unique 는 API가 주지 않으므로 ‘–’ 표시(또는 숨기기)
    elUnique.textContent = '–';

    // ----- 상위 페이지 -----
    let rows = hits.hits?.data ?? hits.hits ?? hits.data ?? hits;
    if (!Array.isArray(rows)) rows = [];
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

    // ----- 스파크라인 -----
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
// ...아래 동일

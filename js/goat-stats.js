(async function(){
  const elTotal = document.getElementById('total');
  const elUnique = document.getElementById('unique');
  const elTop = document.getElementById('top-pages');
  const elRaw = document.getElementById('raw');
  const elSpark = document.getElementById('spark');

  const fmt = n => n==null?'-':String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // proxy strategy:
  // 1) prefer server-side proxy at /api/goat-proxy?path=... (Cloudflare Pages Function)
  // 2) if that fails, try local dev proxy at http://127.0.0.1:8787/proxy?url=...
  // 3) as last resort, try direct fetch to the GoatCounter JSON URL (may fail due to CORS)

  const bodyApi = document.body.dataset.goat; // may be undefined now

  const serverGc = async (p) => {
    const url = '/api/goat-proxy?path=' + encodeURIComponent(p);
    const r = await fetch(url, { cache: 'no-store' });
    if(!r.ok) throw new Error(await r.text());
    return r.json();
  };

  async function tryAll(url){
    // try server proxy -> local proxy -> direct fetch
    try{
      return await serverGc(url);
    }catch(serverErr){
      // try local dev proxy
      const local = 'http://127.0.0.1:8787/proxy?url=' + encodeURIComponent(url);
      try{
        const r2 = await fetch(local, { cache: 'no-store' });
        if(!r2.ok) throw new Error(await r2.text());
        return r2.json();
      }catch(localErr){
        // final attempt: direct fetch (CORS likely)
        try{
          const r3 = await fetch(url, { cache: 'no-store' });
          if(!r3.ok) throw new Error(await r3.text());
          return r3.json();
        }catch(directErr){
          throw new Error('Server: '+serverErr.message+' | Local: '+localErr.message+' | Direct: '+directErr.message);
        }
      }
    }
  }

  const gc = bodyApi ? (p => tryAll(bodyApi)) : (p => tryAll(p));

  try {
    // 병렬 호출: totals + hits(경로별)
    const [totals, hits] = await Promise.all([
      gc('/api/v0/stats/total'),
      gc('/api/v0/stats/hits')
    ]);

    // 디버그 보기
    elRaw.textContent = JSON.stringify({ totals, hits }, null, 2);

    // 총계(필드명이 버전에 따라 조금 다를 수 있어 방어적으로 매핑)
    const total = totals.total?.count ?? totals.total ?? totals.count ?? 0;
    const unique = totals.total?.unique ?? totals.unique ?? 0;
    elTotal.textContent = fmt(total);
    elUnique.textContent = fmt(unique);

    // 상위 페이지
    const pagesArr =
      hits.hits?.data || hits.hits || hits.data || Array.isArray(hits) ? hits : [];
    const top = (Array.isArray(pagesArr) ? pagesArr : []).slice(0, 20);

    if (!top.length) {
      elTop.textContent = '데이터 없음';
    } else {
      const table = document.createElement('table');
      table.style.width='100%'; table.style.borderCollapse='collapse';
      top.forEach((p,i) => {        const path = p.path || p.name || p[0] || '';
        const count = p.count ?? p.views ?? p[1] ?? 0;
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td style="padding:8px 6px; color:#9feccf; width:36px">${i+1}</td>
           <td style="padding:8px 6px;">${path}</td>
           <td style="padding:8px 6px; text-align:right; color:#bfffe7; width:120px">${fmt(count)}</td>`;
        table.appendChild(tr);
      });
      elTop.innerHTML = ''; elTop.appendChild(table);
    }

    // 최근 30일 스파크라인(일별 배열 필드명을 최대한 폭넓게 대응)
    const daily = totals.daily || totals.by_day || totals.days || totals.timeline || [];
    const last30 = daily.slice(-30);
    if (last30.length) {
      const max = Math.max(...last30.map(d => d.count ?? d.views ?? d[1] ?? 0), 1);
      const w = 420, h = 64, pad=4;
      const pts = last30.map((d,idx) => {
        const x = pad + (idx*(w-2*pad)/(last30.length-1||1));
        const yv = d.count ?? d.views ?? d[1] ?? 0;
        const y = h - pad - (yv/max)*(h-2*pad);
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
    elTotal.textContent = '-'; elUnique.textContent = '-';
  }
})();

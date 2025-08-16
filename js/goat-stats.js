(function(){
  const $ = s => document.querySelector(s);
  const fmt = n => n==null ? '-' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // 상태(기간)
  let state = { from: '-30d' };

  // 서버 프록시로 호출
  async function gc(path, from = state.from, extra = '') {
    // path는 /stats/total, /stats/hits 등
    const q = `${path}?from=${encodeURIComponent(from)}${extra}`;
    const url = '/api/goat-proxy?path=' + encodeURIComponent(q);
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  // 전기간(from과 같은 길이만큼 이전) 계산
  function prevFrom(from) {
    // -30d, -90d 형태만 쓰므로 간단 파싱
    const m = /^-(\d+)d$/.exec(from);
    if (!m) return '-30d';
    return `-${m[1]}d`; // GoatCounter가 상대기간을 이해하므로 동일 길이만큼 "이전"도 같은 표현 사용
  }

  function sumDaily(stats) {
    if (!Array.isArray(stats)) return 0;
    return stats.reduce((a, d) => a + (d.daily ?? 0), 0);
  }

  function toDailyArray(stats) {
    if (!Array.isArray(stats)) return [];
    return stats.map(d => ({ date: d.day, count: d.daily ?? 0 }));
  }

  function renderSpark(daily) {
    if (!daily.length) { $('#spark').innerHTML = ''; return; }
    const w = 520, h = 70, pad = 4;
    const max = Math.max(...daily.map(x => x.count), 1);
    const pts = daily.map((d, i) => {
      const x = pad + (i * (w - 2*pad) / (daily.length - 1 || 1));
      const y = h - pad - (d.count / max) * (h - 2*pad);
      return `${x},${y}`;
    }).join(' ');
    $('#spark').innerHTML =
      `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
         <polyline fill="none" stroke="#13e7a1" stroke-width="2" points="${pts}"/>
       </svg>`;
  }

  function tableify(rows, cols) {
    const t = document.createElement('table'); t.className = 'v';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = cols.map(c => `<td>${c(r)}</td>`).join('');
      t.appendChild(tr);
    });
    return t;
  }

  function rankTable(target, rows, showDelta) {
    if (!rows.length) { target.textContent = '데이터 없음'; return; }
    const t = document.createElement('table'); t.className = 'v';
    rows.forEach((r, i) => {
      const d = showDelta && r.delta != null
        ? `<span class="delta ${r.delta >= 0 ? 'up' : 'down'}">${r.delta >= 0 ? '▲' : '▼'} ${fmt(Math.abs(r.delta))}</span>`
        : '';
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td style="width:36px;color:#9feccf">${i+1}</td>
         <td>${r.name || r.path || r.ref || r.country || '-'}</td>
         <td style="width:140px;text-align:right;color:#bfffe7">${fmt(r.count)} ${d ? '&nbsp;&nbsp;'+d : ''}</td>`;
      t.appendChild(tr);
    });
    target.innerHTML = '';
    target.appendChild(t);
  }

  async function load() {
    try {
      // 현재/전기간 병렬 호출
      const [tCur, tPrev, hitsCur, hitsPrev, refsCur, locsCur] = await Promise.all([
        gc('/stats/total'),
        gc('/stats/total', prevFrom(state.from)),                    // 전기간
        gc('/stats/hits', state.from, '&limit=100'),
        gc('/stats/hits', prevFrom(state.from), '&limit=100'),
        // 아래 두 개는 엔드포인트가 없는 플랜/설정이면 실패할 수 있음 → try/catch 대체
        gc('/stats/refs', state.from, '&limit=50').catch(()=>null),
        gc('/stats/locations', state.from, '&limit=50').catch(()=>null),
      ]);

      // 디버그
      $('#raw').textContent = JSON.stringify({ tCur, tPrev, hitsCur, hitsPrev, refsCur, locsCur }, null, 2);

      // ----- 총계/평균/피크/증감 -----
      const dailyCur = toDailyArray(tCur.stats);
      const totalCur = sumDaily(tCur.stats);
      const avg = dailyCur.length ? Math.round(totalCur / dailyCur.length) : 0;
      const peak = dailyCur.reduce((a,b)=> b.count > a.count ? b : a, {date:'-', count:0});

      $('#total').textContent = fmt(totalCur);
      $('#avg').textContent = fmt(avg);
      $('#peak-day').textContent = peak.date || '-';
      $('#peak-count').textContent = fmt(peak.count || 0);
      renderSpark(dailyCur);

      const totalPrev = sumDaily(tPrev.stats);
      const diff = totalCur - totalPrev;
      const pct = totalPrev ? Math.round(diff / totalPrev * 100) : 0;
      const deltaEl = $('#delta span');
      deltaEl.textContent = (diff >= 0 ? '▲ +' : '▼ ') + fmt(Math.abs(diff)) + ` (${pct>=0?'+':''}${pct}%)`;
      deltaEl.className = 'delta ' + (diff >= 0 ? 'up' : 'down');

      // ----- 상위 페이지 (전기간 대비 증감도 표시) -----
      const norm = (rows) => {
        let arr = rows?.hits?.data ?? rows?.hits ?? rows?.data ?? rows;
        if (!Array.isArray(arr)) arr = [];
        return arr.map(x => Array.isArray(x)
          ? { path: x[0], count: x[1] }
          : { path: x.path ?? x.name ?? '', count: x.count ?? x.views ?? 0 });
      };
      const curPages = norm(hitsCur);
      const prevMap = new Map(norm(hitsPrev).map(x => [x.path, x.count]));
      const merged = curPages.slice(0, 20).map(x => ({
        path: x.path, count: x.count, delta: (x.count - (prevMap.get(x.path)||0))
      }));
      rankTable($('#top-pages'), merged, true);

      // ----- Referrers -----
      if (refsCur) {
        let arr = refsCur.refs?.data ?? refsCur.refs ?? refsCur.data ?? refsCur;
        if (!Array.isArray(arr)) arr = [];
        const rows = arr.map(x => Array.isArray(x)
          ? { ref: x[0], count: x[1] }
          : { ref: x.ref ?? x.host ?? x.name ?? '', count: x.count ?? x.views ?? 0 })
          .slice(0, 20);
        rankTable($('#top-refs'), rows, false);
      } else {
        $('#top-refs').textContent = '사용 중인 플랜/설정에서 제공되지 않습니다.';
      }

      // ----- Locations -----
      if (locsCur) {
        let arr = locsCur.locations?.data ?? locsCur.locations ?? locsCur.data ?? locsCur;
        if (!Array.isArray(arr)) arr = [];
        const rows = arr.map(x => Array.isArray(x)
          ? { country: x[0], count: x[1] }
          : { country: x.country ?? x.name ?? '', count: x.count ?? x.views ?? 0 })
          .slice(0, 20);
        rankTable($('#top-locs'), rows, false);
      } else {
        $('#top-locs').textContent = '사용 중인 플랜/설정에서 제공되지 않습니다.';
      }

    } catch (err) {
      $('#raw').textContent = '오류: ' + err.message;
      $('#top-pages').textContent = '데이터 로드 실패';
      $('#top-refs').textContent = '데이터 로드 실패';
      $('#top-locs').textContent = '데이터 로드 실패';
      $('#total').textContent = '-';
      $('#avg').textContent = '-';
      $('#peak-day').textContent = '-';
      $('#peak-count').textContent = '-';
      $('#spark').innerHTML = '';
      $('#delta span').textContent = '-';
      $('#delta span').className = '';
    }
  }

  // 기간 버튼
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.from = btn.dataset.from;
      load();
    });
  });

  load();
})();

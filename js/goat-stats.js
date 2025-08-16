(function () {
  const $ = (s) => document.querySelector(s);

  // 숫자 포맷
  const fmt = (n) => (n == null ? '-' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','));

  // YYYY-MM-DD
  function ymd(d) {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  }
  // 기간 쿼리스트링 (v0 API는 from=-7d 불가 → start, end 필요)
  function makeRangeQS(days) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    return `start=${ymd(start)}&end=${ymd(end)}`;
  }

  // 서버 프록시 호출
  async function gc(pathWithQuery) {
    const r = await fetch('/api/goat-proxy?path=' + encodeURIComponent(pathWithQuery), { cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  function renderTable(target, rows, getRowHtml) {
    if (!rows?.length) {
      target.textContent = '데이터 없음';
      return;
    }
    const table = document.createElement('table');
    table.className = 'simple';
    table.innerHTML = rows
      .map((row, i) => {
        const [c1, c2] = getRowHtml(row, i);
        return `<tr><td class="rank">${i + 1}</td><td>${c1}</td><td class="right">${fmt(c2)}</td></tr>`;
      })
      .join('');
    target.innerHTML = '';
    target.appendChild(table);
  }

  function drawSparkline(series) {
    const container = $('#spark');
    if (!series?.length) {
      container.textContent = '—';
      return;
    }
    const w = container.clientWidth || 420;
    const h = 64, pad = 4;
    const max = Math.max(...series, 1);
    const pts = series.map((v, i) => {
      const x = pad + (i * (w - 2 * pad) / (series.length - 1 || 1));
      const y = h - pad - (v / max) * (h - 2 * pad);
      return `${x},${y}`;
    }).join(' ');

    container.innerHTML =
      `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
         <polyline fill="none" stroke="#13e7a1" stroke-width="2" points="${pts}"/>
       </svg>`;
  }

  async function load(days) {
    const qs = makeRangeQS(days);

    // v0 엔드포인트
    const [totals, hits, refs, countries] = await Promise.all([
      gc(`/stats/total?${qs}`),
      gc(`/stats/hits?${qs}&limit=20`),
      gc(`/stats/referrers?${qs}&limit=20`),
      gc(`/stats/countries?${qs}`),
    ]);

    // 디버그 출력
    $('#raw').textContent = JSON.stringify({ totals, hits, refs, countries }, null, 2);

    // ----- 총합·평균·스파크라인 -----
    // totals.stats = [{ day, hourly:[...], daily: number }, ... ] 형태
    const dailyArr = (totals.stats || []).map(d => (d.daily ?? d.count ?? 0));
    const totalCount = totals.total?.count ?? totals.total ?? totals.count ?? dailyArr.reduce((a, b) => a + b, 0);
    $('#total').textContent = fmt(totalCount);

    const avg = dailyArr.length ? (totalCount / dailyArr.length) : 0;
    $('#avg').textContent = fmt(avg);
    $('#peak').textContent = fmt(Math.max(...dailyArr, 0));
    drawSparkline(dailyArr);

    // ----- 상위 페이지 -----
    // hits.data 또는 hits.hits 또는 배열
    const pagesData = hits.data ?? hits.hits ?? hits;
    const pages = Array.isArray(pagesData)
      ? pagesData.map(p => ({ path: p.path ?? p.name ?? p[0], count: p.count ?? p.views ?? p[1] ?? 0 }))
      : [];
    renderTable($('#top-pages'), pages, (r) => [r.path || '(unknown)', r.count]);

    // ----- 리퍼러 -----
    const refsData = refs.data ?? refs.referrers ?? refs;
    const refRows = Array.isArray(refsData)
      ? refsData.map(p => ({ name: p.name ?? p.referrer ?? p[0], count: p.count ?? p.views ?? p[1] ?? 0 }))
      : [];
    renderTable($('#top-refs'), refRows, (r) => [r.name || '(direct/none)', r.count]);

    // ----- 국가 -----
    const cData = countries.data ?? countries.countries ?? countries;
    const cRows = Array.isArray(cData)
      ? cData.map(p => ({ name: p.name ?? p.country ?? p.code ?? p[0], count: p.count ?? p.views ?? p[1] ?? 0 }))
      : [];
    renderTable($('#top-countries'), cRows, (r) => [r.name || '(unknown)', r.count]);
  }

  // 기간 선택 핸들링
  function initPills() {
    const pills = Array.from(document.querySelectorAll('.pill'));
    const setActive = (el) => pills.forEach(p => p.classList.toggle('active', p === el));
    const defaultDays = 30;
    let current = defaultDays;

    pills.forEach(p => {
      p.addEventListener('click', async () => {
        const days = Number(p.dataset.days || defaultDays);
        if (days === current) return;
        current = days;
        setActive(p);
        try {
          await load(days);
        } catch (e) {
          $('#raw').textContent = '오류: ' + e.message;
        }
      });
    });

    // 초기값(30일)
    const initial = pills.find(p => Number(p.dataset.days) === defaultDays) || pills[0];
    setActive(initial);
  }

  // 시작
  window.addEventListener('DOMContentLoaded', async () => {
    initPills();
    try {
      await load(30);
    } catch (e) {
      $('#raw').textContent = '오류: ' + e.message;
    }
  });
})();

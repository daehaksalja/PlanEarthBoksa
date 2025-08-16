// Supabase 연결
const supabaseUrl = 'https://feprvneoartflrnmefxz.supabase.co';
const supabaseKey = 'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

/* -----------------------
 * 유틸
 * ---------------------*/
// 텍스트 이스케이프(XSS/깨짐 방지)
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// 제목 길이에 따른 폰트 자동 조정
function setTitleFontSizeByLength(selector, baseFontSize = 15, minFontSize = 10) {
  document.querySelectorAll(selector).forEach(el => {
    const text = el.textContent.replace(/\s+/g, '').replace(/\n/g, '');
    const len = text.length;
    let size = baseFontSize;
    if (len > 10) size = Math.max(minFontSize, baseFontSize - (len - 10) * 0.7);
    el.style.fontSize = size + 'px';
  });
}

// 스크롤 위치 복원
function restoreScroll() {
  const navEntries = performance.getEntriesByType('navigation');
  const isBackForward = navEntries[0]?.type === 'back_forward';
  if (isBackForward) {
    const savedY = sessionStorage.getItem('scrollY');
    if (savedY !== null) {
      // 렌더 완료 직후 복원
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedY, 10));
      });
    }
  } else {
    sessionStorage.removeItem('scrollY');
  }
}
// bfcache 복원 대비
window.addEventListener('pageshow', (e) => {
  if (e.persisted) restoreScroll();
});

// 리사이즈 디바운스 + rAF
let resizeTimer, resizeRAF;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  if (resizeRAF) cancelAnimationFrame(resizeRAF);
  resizeTimer = setTimeout(() => {
    resizeRAF = requestAnimationFrame(() => setTitleFontSizeByLength('.work-title', 18, 12));
  }, 100);
});

/* -----------------------
 * 데이터 로드 & 렌더
 * ---------------------*/
async function loadWorks() {
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .order('works_order_index', { ascending: true });

  if (error) {
    alert('DB 로드 오류! ' + error.message);
    return;
  }

  const grid = document.querySelector('.works-grid');
  grid.innerHTML = '';

  (data || []).forEach(item => {
    const href = `works-detail.html?id=${encodeURIComponent(item.id)}`;
    const title = esc(item.title);
    const subtitle = esc(item.subtitle ?? '');
    const imgSrc = item.image_url || '/assets/images/placeholder.png';

    const html = `
      <a class="work-item" href="${href}" title="${title}">
        <img src="${imgSrc}"
             alt="${title}"
             loading="lazy" decoding="async"
             onerror="this.src='/assets/images/placeholder.png'">
        <div class="work-title">${title}<br><span>${subtitle}</span></div>
      </a>
    `;
    grid.insertAdjacentHTML('beforeend', html);
  });

  // 길이에 따른 폰트 조정
  setTitleFontSizeByLength('.work-title');

  // 클릭 시 스크롤 저장
  document.querySelectorAll('.work-item').forEach(link => {
    link.addEventListener('click', () => {
      sessionStorage.setItem('scrollY', String(window.scrollY));
    });
  });

  // 마지막에 스크롤 복원
  restoreScroll();
}

// 시작!
loadWorks();

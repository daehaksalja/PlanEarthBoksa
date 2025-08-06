// Supabase 연결
const supabaseUrl = 'https://feprvneoartflrnmefxz.supabase.co';
const supabaseKey = 'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// 🔥 폰트 사이즈 자동 조정
function setTitleFontSizeByLength(selector, baseFontSize = 15, minFontSize = 10) {
  document.querySelectorAll(selector).forEach(el => {
    const text = el.textContent.replace(/\s+/g, '').replace(/\n/g, '');
    const len = text.length;
    let size = baseFontSize;
    if (len > 10) {
      size = Math.max(minFontSize, baseFontSize - (len - 10) * 0.7);
    }
    el.style.fontSize = size + "px";
  });
}

// 🔁 스크롤 복원 함수 (로드 후 호출)
function restoreScroll() {
  const navEntries = performance.getEntriesByType('navigation');
  const isBackForward = navEntries[0]?.type === 'back_forward';

  if (isBackForward) {
    const savedY = sessionStorage.getItem('scrollY');
    if (savedY !== null) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedY));
      }, 0);
    }
  } else {
    sessionStorage.removeItem('scrollY'); // ✅ 새로 진입한 경우 초기화
  }
}


// 📐 창 크기 바뀔 때 폰트 다시 계산
window.addEventListener('resize', () => {
  setTitleFontSizeByLength('.work-title', 18, 12);
});

// 🔄 데이터 로드 + 렌더링
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

  data.forEach(item => {
    const html = `
      <a class="work-item" href="works-detail.html?id=${item.id}" title="${item.title}">
        <img src="${item.image_url}" alt="${item.title}">
        <div class="work-title">${item.title}<br><span>${item.subtitle ?? ''}</span></div>
      </a>
    `;
    grid.insertAdjacentHTML('beforeend', html);
  });

  // 텍스트 길이에 따라 폰트 크기 조정
  setTitleFontSizeByLength('.work-title');

  // 🔸 클릭 시 현재 스크롤 저장
  document.querySelectorAll('.work-item').forEach(link => {
    link.addEventListener('click', () => {
      sessionStorage.setItem('scrollY', window.scrollY);
    });
  });

  // ✅ 모든 요소 생성 완료 후 스크롤 복원 실행!
  restoreScroll();
}

// 시작
loadWorks();

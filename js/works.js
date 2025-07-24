// supabase 라이브러리 불러오기 (CDN 사용시 필요없음! 아래 script태그 참고)


const supabaseUrl = 'https://feprvneoartflrnmefxz.supabase.co';
const supabaseKey = 'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
// 1. 데이터 로딩 후 setTitleFontSizeByLength() 호출!
async function loadWorks() {
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .order('id', { ascending: true });

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

  // 🔥 카드 생성 후 폰트 크기 조정!
  setTitleFontSizeByLength('.work-title');
}

function setTitleFontSizeByLength(selector, baseFontSize = 15, minFontSize = 10) {
  document.querySelectorAll(selector).forEach(el => {
    // <br> 등 HTML 태그 제거, 한글+영문 구분 없이 길이 체크
    const text = el.textContent.replace(/\s+/g, '').replace(/\n/g, '');
    const len = text.length;
    let size = baseFontSize;
    if (len > 10) {
      size = Math.max(minFontSize, baseFontSize - (len - 10) * 0.7);
    }
    el.style.fontSize = size + "px";
  });
}

window.addEventListener('resize', () => {
  setTitleFontSizeByLength('.work-title', 18, 12); //기본폰트사이즈, 최소폰트사이즈
});

loadWorks();

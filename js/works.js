// supabase 라이브러리 불러오기 (CDN 사용시 필요없음! 아래 script태그 참고)


const supabaseUrl = 'https://feprvneoartflrnmefxz.supabase.co';
const supabaseKey = 'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
async function loadWorks() {
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .order('id', { ascending: true });

  console.log('supabase에서 받아온 data:', data);
  console.log('supabase error:', error);

  if (error) {
    alert('DB 로드 오류! ' + error.message);
    return;
  }

  const grid = document.querySelector('.works-grid');
  grid.innerHTML = '';

  data.forEach(item => {
    const html = `
      <div class="work-item">
        <img src="${item.image_url}" alt="${item.title}">
        <div class="work-title">${item.title}<br><span>${item.subtitle ?? ''}</span></div>
      </div>
    `;
    grid.insertAdjacentHTML('beforeend', html);
  });
}

loadWorks();

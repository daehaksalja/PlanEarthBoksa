const supabase = window.supabase.createClient(
  'https://feprvneoartflrnmefxz.supabase.co',
  'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
);

async function loadWorks() {
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .order('works_order_index', { ascending: true });

  const grid = document.getElementById('works-grid');
  grid.innerHTML = '';

  if (error) {
    console.error('❌ works 불러오기 오류:', error);
    return;
  }

  data.forEach(item => {
    const el = document.createElement('div');
    el.className = 'work-item';
    el.setAttribute('data-id', item.id);
    el.innerHTML = `
      <img src="${item.image_url}" alt="썸네일">
      <div class="work-title">${item.title}<br><span>${item.subtitle ?? ''}</span></div>
    `;
    grid.appendChild(el);
  });

  setTitleFontSizeByLength('.work-title');
}

function setTitleFontSizeByLength(selector, baseFontSize = 15, minFontSize = 10) {
  document.querySelectorAll(selector).forEach(el => {
    const text = el.textContent.replace(/\s+/g, '').replace(/\n/g, '');
    const len = text.length;
    let size = baseFontSize;
    if (len > 10) {
      size = Math.max(minFontSize, baseFontSize - (len - 10) * 0.7);
    }
    el.style.fontSize = size + 'px';
  });
}

function showLoading() {
  document.getElementById('loading-overlay').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}


// ✅ 드래그 정렬
new Sortable(document.getElementById('works-grid'), {
  animation: 200,
  ghostClass: 'sortable-ghost',
});

// ✅ 순서 저장
document.getElementById('save-order').addEventListener('click', async () => {
  console.log('🟡 순서 저장 버튼 클릭됨');
  showLoading();

  const items = document.querySelectorAll('.works-grid .work-item');
  const updates = [];

  items.forEach((item, index) => {
    const id = item.dataset.id;
    const indexNum = index + 1;
    console.log(`📦 ID ${id} → works_order_index = ${indexNum}`);
    updates.push({ id, works_order_index: indexNum });
  });

  for (const row of updates) {
    const { error } = await supabase
      .from('works')
      .update({ works_order_index: row.works_order_index })
      .eq('id', row.id);

    if (error) {
      console.error(`❌ 업데이트 실패 (id: ${row.id})`, error);
    } else {
      console.log(`✅ 업데이트 성공 (id: ${row.id})`);
    }
  }


  alert('✅ 순서 저장 완료!');
   hideLoading();
});

// ✅ 로그아웃
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

// ✅ 시작
loadWorks();

const supabase = window.supabase.createClient(
  'https://feprvneoartflrnmefxz.supabase.co',
  'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
);
// 20개 단위로 안전하게 병렬 업데이트
async function updateInChunks(updates, chunkSize = 20) {
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(chunk.map(row =>
      supabase.from('works')
        .update({ works_order_index: row.works_order_index })
        .eq('id', row.id)
    ));
  }
}

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
  const overlay = document.getElementById('loading-overlay'); // 꼭 선언!
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay'); // 꼭 선언!
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 400);
}
// function showToast(message, icon = "") {
//   const toast = document.getElementById('toast');
//   toast.innerHTML = `<span class="toast-icon">${icon}</span>${message}`;
//   toast.classList.add('show');
//   clearTimeout(toast._timer);
//   toast._timer = setTimeout(() => {
//     toast.classList.remove('show');
//   }, 2100); // 2.1초 보여주고 사라짐
// }
function showSweetToast(message = "Success!", icon = "success", time = 1500) {
  Swal.fire({
    toast: true,
    position: 'center',
    icon: icon,             // 'success' | 'info' | 'warning' | 'error' | 'question'
    title: message,
    iconColor: 'white',     // 아이콘 흰색
    customClass: {
      popup: 'colored-toast'
    },
    showConfirmButton: false,
    timer: time,
    timerProgressBar: true
  });
}


// ✅ 드래그 정렬
new Sortable(document.getElementById('works-grid'), {
  animation: 200,
  ghostClass: 'sortable-ghost',
});

// ✅ 순서 저장
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


    // 2. 전부 널로 초기화! (이거는 한 번에 보내도 안전함)
  await Promise.all(updates.map(row =>
    supabase.from('works')
      .update({ works_order_index: null })
      .eq('id', row.id)
  ));

  // 🟡 이 한줄! 20개 단위로 병렬 업데이트
  await updateInChunks(updates, 20);



  showSweetToast("Operation complete.");
  hideLoading();
});


// ✅ 로그아웃
document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
});

// ✅ 시작
loadWorks();

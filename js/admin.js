// 👉 Supabase
const supabase = window.supabase.createClient(
  'https://feprvneoartflrnmefxz.supabase.co',
  'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
);

// 👉 UI helpers
const $ = s => document.querySelector(s);

const toast = (msg = '완료!', icon = 'success') =>
  Swal.fire({ toast: true, position: 'center', icon, title: msg, showConfirmButton: false, timer: 1300 });

// 👉 데이터 로드 + 렌더 (재생목록 스타일)
async function loadWorks() {
  console.log('📡 [loadWorks] 재생목록 불러오기 시작');
  const list = $('#works-list');
  list.innerHTML = '';

  const { data, error } = await supabase
    .from('works')
    .select('*')
    .order('works_order_index', { ascending: true });

  if (error) {
    console.error('❌ [loadWorks] 불러오기 실패:', error);
    return toast('불러오기 실패', 'error');
  }

  console.log(`✅ [loadWorks] 불러온 데이터 ${data.length}개`, data);

  data.forEach((it, i) => {
    const li = document.createElement('li');
    li.className = 'row';
    li.dataset.id = it.id;

    li.innerHTML = `
      <div class="idx">${i + 1}</div>
      <button class="drag" title="드래그로 순서 변경">≡</button>
      <img class="thumb" src="${it.image_url || ''}" alt="" draggable="false">
      <div class="meta">
        <div class="title">${it.title || ''}</div>
        <div class="sub">${it.subtitle || ''}</div>
      </div>
      <div class="right">${it.duration || ''}</div>
    `;
    list.appendChild(li);
  });

  initSortable();
}

// 👉 Sortable 활성화 (행 드래그)
let sortable;
function initSortable() {
  const list = $('#works-list');
  if (sortable) sortable.destroy();

  sortable = new Sortable(list, {
    handle: '.drag',
    animation: 180,
    ghostClass: 'ghost',
    chosenClass: 'chosen',
    dragClass: 'dragging',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 5,
    scroll: true,
    scrollSensitivity: 60,
    scrollSpeed: 12,
    onEnd: () => {
      console.log('🔄 [Sortable] 순서 변경 발생');
      renumber();
    }
  });
}

// 👉 번호 다시 매기기
function renumber() {
  console.log('🔢 [renumber] 리스트 번호 재정렬');
  $('#works-list').querySelectorAll('.row .idx').forEach((el, i) => {
    el.textContent = i + 1;
  });
}

// 👉 로딩 오버레이 on/off
function showLoading() {
  console.log('⏳ [Loading] 로딩 오버레이 표시');
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));
}
function hideLoading() {
  console.log('✅ [Loading] 로딩 오버레이 숨김');
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 380);
}

// 👉 순서 저장
$('#save-order').addEventListener('click', async () => {
  console.log('💾 [SaveOrder] 순서 저장 시작');
  showLoading();
  try {
    const rows = Array.from($('#works-list').querySelectorAll('.row'));
    const updates = rows.map((row, i) => ({
      id: row.dataset.id,
      works_order_index: i + 1
    }));

    console.log('📋 [SaveOrder] 업데이트 준비 데이터:', updates);

    // 1) 모두 null 초기화
    console.log('🚮 [SaveOrder] works_order_index 전체 null 초기화');
    await Promise.all(updates.map(u =>
      supabase.from('works').update({ works_order_index: null }).eq('id', u.id)
    ));
    console.log('✅ [SaveOrder] null 초기화 완료');

    // 2) 청크로 업데이트
    for (let i = 0; i < updates.length; i += 20) {
      const chunk = updates.slice(i, i + 20);
      console.log(`📦 [SaveOrder] 청크 업데이트 (${i} ~ ${i + chunk.length - 1})`, chunk);
      await Promise.all(chunk.map(u =>
        supabase.from('works').update({ works_order_index: u.works_order_index }).eq('id', u.id)
      ));
    }

    console.log('🎉 [SaveOrder] 전체 순서 저장 성공');
    toast('COMPLETE');
  } catch (e) {
    console.error('❌ [SaveOrder] 저장 실패:', e);
    toast('저장 실패…', 'error');
  } finally {
    hideLoading();
  }
});

// 👉 로그아웃
$('#logout-btn').addEventListener('click', async () => {
  console.log('🚪 [Logout] 로그아웃 실행');
  await supabase.auth.signOut();
  location.href = 'login.html';
});

// 시작!
console.log('🚀 [Init] 페이지 로드 완료 → loadWorks 실행');
loadWorks();

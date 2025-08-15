// ===== Supabase 초기화 =====
const supabase = window.supabase.createClient(
  'https://feprvneoartflrnmefxz.supabase.co',
  'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
);

// ===== Helpers =====
const $ = (s) => document.querySelector(s);
const toast = (msg='완료!', icon='success') =>
  Swal.fire({ toast:true, position:'center', icon, title: msg, showConfirmButton:false, timer:1300 });

// 🔹 파일명용 슬러그 유틸 (subtitle → 파일명 규칙)
function makeSlug(text){
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, '') // 문자/숫자/공백/_/-만
    .replace(/\s+/g, '_')                // 공백 → _
    .replace(/_+/g, '_')                 // 연속 _ 축소
    .replace(/^_+|_+$/g, '');            // 앞뒤 _ 제거
}

// 로그인 체크
async function checkAuth(){
  const { data:{ user }, error } = await supabase.auth.getUser();
  if(error || !user){ location.href = 'login.html'; return false; }
  return true;
}

// 로딩 오버레이
function showLoading(){
  const o = document.getElementById('loading-overlay');
  if(!o) return;
  o.style.display='flex';
  requestAnimationFrame(()=>o.classList.add('active'));
}
function hideLoading(){
  const o = document.getElementById('loading-overlay');
  if(!o) return;
  o.classList.remove('active');
  setTimeout(()=>{ o.style.display='none'; }, 380);
}

// Works 불러오기
async function loadWorks(){
  const list = $('#works-list'); list.innerHTML = '';
  const { data, error } = await supabase
    .from('works')
    .select('*')
    .order('works_order_index', { ascending: true });

  if(error){ console.error(error); return toast('불러오기 실패','error'); }

  (data||[]).forEach((it, i) => {
    const li = document.createElement('li'); li.className='row'; li.dataset.id = it.id;
    li.innerHTML = `
      <div class="idx">${i+1}</div>
      <button class="drag" title="드래그로 순서 변경">≡</button>
      <img class="thumb" src="${it.image_url||''}" alt="" draggable="false">
      <div class="meta">
        <div class="title">${it.title||''}</div>
        <div class="sub">${it.subtitle||''}</div>
      </div>
      <div class="right">${it.duration||''}</div>
      <button class="del-work" title="삭제">🗑️</button>`;
    list.appendChild(li);
  });
  initSortable();
}

// 행 삭제(이벤트 위임) — (현재는 DB만 삭제, 필요하면 R2도 삭제 훅 추가 가능)
document.getElementById('works-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('.del-work'); if(!btn) return;
  const li = btn.closest('.row'); if(!li) return; const id = li.dataset.id;
  const res = await Swal.fire({
    title: '정말 삭제할래?',
    text: '이 작업은 복구할 수 없어.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '삭제',
    cancelButtonText: '취소'
  });
  if(!res.isConfirmed) return;

  showLoading();
  try {
    // 연관 이미지 삭제
    const { error: delImgsErr } = await supabase.from('images').delete().eq('work_id', id);
    if(delImgsErr) throw delImgsErr;

    // 작품 자체 삭제
    const { error } = await supabase.from('works').delete().eq('id', id);
    if(error) throw error;

    // 삭제 후 목록 로드 및 인덱스 재정렬 저장
    await loadWorks();
    await persistOrderFromDOM();

    // 삭제 성공 안내 토스트
    toast('삭제 완료', 'success');
  } catch(err){
    console.error('삭제 실패', err);
    Swal.fire({ icon: 'error', title: '삭제 실패', text: err.message || '' });
  } finally { hideLoading(); }
});

// Sortable 활성화(행)
let sortable;
function initSortable(){
  const list = $('#works-list'); if(sortable) sortable.destroy();
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
    onEnd: renumber
  });
}
function renumber(){
  $('#works-list').querySelectorAll('.row .idx').forEach((el, i)=> el.textContent = i+1 );
}

// 순서 저장 (공유 함수로 추출)
async function persistOrderFromDOM(){
  showLoading();
  try{
    const rows = Array.from($('#works-list').querySelectorAll('.row'));
    const updates = rows.map((row, i) => ({ id: row.dataset.id, works_order_index: i+1 }));

    // 먼저 모두 null로 초기화 (중복 인덱스 방지)
    await Promise.all(
      updates.map(u => supabase.from('works').update({ works_order_index: null }).eq('id', u.id))
    );

    // 20개씩 나눠서 업데이트
    for(let i=0; i<updates.length; i+=20){
      const chunk = updates.slice(i, i+20);
      await Promise.all(
        chunk.map(u => supabase.from('works').update({ works_order_index: u.works_order_index }).eq('id', u.id))
      );
    }
  } finally {
    hideLoading();
  }
}

// 순서 저장 버튼
$('#save-order').addEventListener('click', async ()=>{
  try{
    await persistOrderFromDOM();
    toast('순서 저장 완료', 'success');
  }catch(e){
    console.error('순서 저장 실패', e);
    toast('순서 저장 실패','error');
  }
});

// 로그아웃
$('#logout-btn').addEventListener('click', async ()=>{
  await supabase.auth.signOut();
  location.href = 'login.html';
});

// 페이지 init
async function initPage(){
  if(!await checkAuth()) return;
  await loadWorks();
}

/* =========================
 *  Sheet 상태/버퍼
 * ========================= */
let SHEET_MODE = 'create';
let CURRENT_ID = null;
let thumbFile = null;
const galleryItems = [];  // { id?, url?, file?, caption, _key }
const $S = (s) => document.querySelector(s);

// Sheet 열기/닫기
function openSheet(mode='create', workId=null){
  SHEET_MODE = mode;
  CURRENT_ID = workId;
  $S('#sheet-title').textContent = (mode==='create') ? '춘식이 추가' : '춘식이 편집';
  resetSheetForm();
  $S('#edit-sheet').classList.add('open');
  $S('#sheet-backdrop').classList.add('open');
  if(mode==='edit' && workId) loadWorkIntoForm(workId);
}
function closeSheet(){
  $S('#edit-sheet').classList.remove('open');
  $S('#sheet-backdrop').classList.remove('open');
}
window.openSheet = openSheet; // 디버깅용

$S('#sheet-close').addEventListener('click', closeSheet);
$S('#sheet-cancel').addEventListener('click', closeSheet);
$S('#sheet-backdrop').addEventListener('click', closeSheet);
addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeSheet(); });

function resetSheetForm(){
  thumbFile = null;
  galleryItems.length = 0;
  $S('#f-title').value = '';
  $S('#f-subtitle').value = '';
  const tp = $S('#thumb-preview');
  tp.src='';
  tp.style.display='none';
  $S('#gallery-list').innerHTML = '';
}

// 대표 이미지
$S('#btn-thumb').addEventListener('click', ()=> $S('#f-thumb').click());
$S('#f-thumb').addEventListener('change', (e)=>{
  const f = e.target.files?.[0];
  if(!f) return;
  setThumbPreview(f);
});
const thumbDrop = $S('#thumb-drop');
;['dragenter','dragover'].forEach(ev =>
  thumbDrop.addEventListener(ev, (e)=>{ e.preventDefault(); thumbDrop.classList.add('dragover'); })
);
;['dragleave','drop'].forEach(ev =>
  thumbDrop.addEventListener(ev, (e)=>{ e.preventDefault(); thumbDrop.classList.remove('dragover'); })
);
thumbDrop.addEventListener('drop', (e)=>{
  const f = e.dataTransfer?.files?.[0];
  if(!f) return;
  setThumbPreview(f);
});
function setThumbPreview(file){
  thumbFile = file;
  const url = URL.createObjectURL(file);
  const img = $S('#thumb-preview');
  img.src = url;
  img.style.display='block';
}

// 갤러리
$S('#btn-gallery').addEventListener('click', ()=> $S('#f-gallery').click());
$S('#f-gallery').addEventListener('change', (e)=> addGalleryFiles(e.target.files));
const galDrop = $S('#gallery-drop');
;['dragenter','dragover'].forEach(ev =>
  galDrop.addEventListener(ev, (e)=>{ e.preventDefault(); galDrop.classList.add('dragover'); })
);
;['dragleave','drop'].forEach(ev =>
  galDrop.addEventListener(ev, (e)=>{ e.preventDefault(); galDrop.classList.remove('dragover'); })
);
galDrop.addEventListener('drop', (e)=> addGalleryFiles(e.dataTransfer?.files));

function addGalleryFiles(fileList){
  if(!fileList||!fileList.length) return;
  [...fileList].forEach(file=>{
    galleryItems.push({ file, caption:'', _key: crypto.randomUUID() });
  });
  renderGallery();
}

function renderGallery(){
  const ul = $S('#gallery-list'); ul.innerHTML='';
  galleryItems.forEach(it=>{
    const li = document.createElement('li'); li.className='gallery-item'; li.dataset.key = it._key;
    const img = document.createElement('img'); img.className='g-thumb';
    img.src = it.url ? it.url : URL.createObjectURL(it.file);
    const cap = document.createElement('input'); cap.type='text'; cap.className='g-cap';
    cap.placeholder='캡션(선택)'; cap.value = it.caption||'';
    cap.addEventListener('input', (e)=> it.caption = e.target.value);
    const handle = document.createElement('button'); handle.className='g-handle'; handle.innerHTML='≡'; handle.title='드래그로 순서 변경';
    const del = document.createElement('button'); del.className='g-del'; del.textContent='삭제';
    del.addEventListener('click', ()=>{
      const idx = galleryItems.findIndex(x=>x._key===it._key);
      if(idx>=0) galleryItems.splice(idx,1);
      renderGallery();
    });
    li.append(img, cap, handle, del);
    ul.appendChild(li);
  });

  if(window.Sortable){
    if(renderGallery.sortable) renderGallery.sortable.destroy();
    renderGallery.sortable = new Sortable($S('#gallery-list'), {
      animation:150,
      handle:'.g-handle',
      onEnd: ()=>{
        const order=[...$S('#gallery-list').children].map(li=>li.dataset.key);
        galleryItems.sort((a,b)=> order.indexOf(a._key) - order.indexOf(b._key));
      }
    });
  }
}

// 편집 로드
async function loadWorkIntoForm(id){
  const { data: work, error: wErr } = await supabase.from('works').select('*').eq('id', id).single();
  if(wErr||!work){ console.error(wErr); return toast('불러오기 실패','error'); }

  $S('#f-title').value = work.title||'';
  $S('#f-subtitle').value = work.subtitle||'';
  $S('#f-since').value = work.since||'';
  if(work.image_url){
    const img = $S('#thumb-preview');
    img.src = work.image_url;
    img.style.display='block';
    thumbFile = null;
  }

  const { data: imgs, error: iErr } = await supabase
    .from('images')
    .select('*')
    .eq('work_id', id)
    .order('order_index', { ascending: true });

  if(iErr){ console.error(iErr); return; }

  galleryItems.length = 0;
  (imgs||[]).forEach(row =>
    galleryItems.push({ id: row.id, url: row.url, caption: row.caption||'', _key: 'db-'+row.id })
  );
  renderGallery();
}

// 저장
$S('#sheet-save').addEventListener('click', saveAll);
addEventListener('keydown', (e)=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){
    if($S('#edit-sheet').classList.contains('open')){
      e.preventDefault();
      saveAll();
    }
  }
});

async function saveAll(){
  const title = $S('#f-title').value.trim();
  const subtitle = $S('#f-subtitle').value.trim();
  const since = $S('#f-since').value.trim();

  if(!title) return Swal.fire({ icon:'warning', title:'제목을 입력해줘!' });
  if(SHEET_MODE==='create' && !thumbFile) return Swal.fire({ icon:'info', title:'대표 이미지를 넣어줘!' });

  showLoading();
  try {
    let workId = CURRENT_ID;

    // 1) works 생성/업데이트
    if(SHEET_MODE==='create'){
      // 현재 최대 works_order_index 조회해서 삽입 시 인덱스 부여
      try{
        const { data: maxRows, error: maxErr } = await supabase
          .from('works')
          .select('works_order_index')
          .order('works_order_index', { ascending: false })
          .limit(1);
        if(maxErr) console.warn('순서 조회 실패', maxErr);

        let maxIndex = 0;
        if(Array.isArray(maxRows) && maxRows.length && typeof maxRows[0].works_order_index === 'number'){
          maxIndex = maxRows[0].works_order_index;
        }

        const { data, error } = await supabase
          .from('works')
          .insert([{ title, subtitle, since, works_order_index: maxIndex + 1 }])
          .select('id')
          .single();
        if(error) throw error;
        workId = data.id;
      }catch(e){
        console.error('새 항목 생성 및 순서 자동 부여 중 오류', e);
        throw e;
      }
    } else {
      const { error } = await supabase.from('works').update({ title, subtitle, since }).eq('id', workId);
      if(error) throw error;
    }

    // 🔹 파일명에 쓸 슬러그
    const slug = makeSlug(subtitle || title) || 'untitled';

    // 2) 대표 이미지 업로드 → works.image_url 업데이트
    if(thumbFile){
      const coverUrl = await uploadToR2(thumbFile, { workId, slug, kind:'cover' });
      const { error } = await supabase.from('works').update({ image_url: coverUrl }).eq('id', workId);
      if(error) throw error;
    }

    // 3) 갤러리 diff
    const { data: dbImgs } = await supabase.from('images').select('id').eq('work_id', workId);
    const keepIds = new Set(galleryItems.filter(x=>x.id).map(x=>x.id));
    const toDelete = (dbImgs||[]).map(r=>r.id).filter(id=>!keepIds.has(id));
    if(toDelete.length){
      await supabase.from('images').delete().in('id', toDelete);
    }

    for(let i=0;i<galleryItems.length;i++){
      const it = galleryItems[i];
      const orderIdx = i+1;
      if(it.file){
        const url = await uploadToR2(it.file, { workId, slug, kind:'gallery', index: orderIdx });
        const { error } = await supabase.from('images').insert([{
          work_id: workId,
          url,
          caption: it.caption||'',
          order_index: orderIdx
        }]);
        if(error) throw error;
      } else if(it.id){
        const { error } = await supabase
          .from('images')
          .update({ caption: it.caption||'', order_index: orderIdx })
          .eq('id', it.id);
        if(error) throw error;
      }
    }

    // 비차단 토스트로 완료 알림, 시트 닫기 및 목록 갱신
    toast('저장 완료!', 'success');
    closeSheet();
    await loadWorks();

    // 저장 후 인덱스 재정렬 저장
    try{
      await persistOrderFromDOM();
    }catch(e){
      console.error('인덱스 저장 실패', e);
      // 실패시 별도 UX는 생략
    }
  } catch(e){
    console.error(e);
    Swal.fire({ icon:'error', title:'저장 실패', text: e.message||'오류' });
  } finally { hideLoading(); }
}

/* =========================
 *  업로드 훅 — Cloudflare Pages Functions로 교체됨
 *  /functions/r2-upload.js 엔드포인트 호출
 * ========================= */
async function uploadToR2(file, { workId, slug, kind='cover', index=0 }){
  const fd = new FormData();
  fd.append('file', file);
  fd.append('workId', String(workId));
  fd.append('slug', slug);
  fd.append('kind', kind);
  if(kind === 'gallery') fd.append('index', String(index));

  const res = await fetch('/r2-upload', { method: 'POST', body: fd });
  const json = await res.json();
  if(!res.ok) throw new Error(json.error || '업로드 실패');
  return json.url; // 퍼블릭 URL 반환
}

// 트리거 연결
document.getElementById('add-work-btn').addEventListener('click', ()=> openSheet('create'));

// 행 더블클릭 → 편집
document.addEventListener('dblclick', (e)=>{
  const row = e.target.closest('.row');
  if(!row) return;
  openSheet('edit', row.dataset.id);
});

// (선택) 단일 클릭으로도 편집 열기
// document.addEventListener('click', (e)=>{
//   if(e.target.closest('.drag')) return;
//   const row = e.target.closest('.row');
//   if(!row) return;
//   openSheet('edit', row.dataset.id);
// });

// 시작
initPage();

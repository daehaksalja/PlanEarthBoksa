 // ===== Supabase 초기화 =====
  const supabase = window.supabase.createClient(
    'https://feprvneoartflrnmefxz.supabase.co',
    'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
  );

  // ===== Helpers =====
  const $ = (s) => document.querySelector(s);
  const toast = (msg='완료!', icon='success') => Swal.fire({ toast:true, position:'center', icon, title: msg, showConfirmButton:false, timer:1300 });

  // 로그인 체크
  async function checkAuth(){
    const { data:{ user }, error } = await supabase.auth.getUser();
    if(error || !user){ location.href = 'login.html'; return false; }
    return true;
  }

  // 로딩 오버레이
  function showLoading(){ const o = document.getElementById('loading-overlay'); if(!o) return; o.style.display='flex'; requestAnimationFrame(()=>o.classList.add('active')); }
  function hideLoading(){ const o = document.getElementById('loading-overlay'); if(!o) return; o.classList.remove('active'); setTimeout(()=>{ o.style.display='none'; }, 380); }

  // Works 불러오기
  async function loadWorks(){
    const list = $('#works-list'); list.innerHTML = '';
    const { data, error } = await supabase.from('works').select('*').order('works_order_index', { ascending: true });
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
        <div class="right">${it.duration||''}</div>`;
      list.appendChild(li);
    });
    initSortable();
  }

  // Sortable 활성화(행)
  let sortable;
  function initSortable(){
    const list = $('#works-list'); if(sortable) sortable.destroy();
    sortable = new Sortable(list, {
      handle: '.drag', animation: 180, ghostClass: 'ghost', chosenClass: 'chosen', dragClass: 'dragging',
      forceFallback: true, fallbackOnBody: true, fallbackTolerance: 5, scroll: true, scrollSensitivity: 60, scrollSpeed: 12,
      onEnd: renumber
    });
  }
  function renumber(){ $('#works-list').querySelectorAll('.row .idx').forEach((el, i)=> el.textContent = i+1 ); }

  // 순서 저장
  $('#save-order').addEventListener('click', async ()=>{
    showLoading();
    try {
      const rows = Array.from($('#works-list').querySelectorAll('.row'));
      const updates = rows.map((row, i) => ({ id: row.dataset.id, works_order_index: i+1 }));
      await Promise.all(updates.map(u => supabase.from('works').update({ works_order_index: null }).eq('id', u.id)));
      for(let i=0; i<updates.length; i+=20){
        const chunk = updates.slice(i, i+20);
        await Promise.all(chunk.map(u => supabase.from('works').update({ works_order_index: u.works_order_index }).eq('id', u.id)));
      }
      toast('COMPLETE');
    } catch(e){ console.error(e); toast('저장 실패…','error'); }
    finally { hideLoading(); }
  });

  // 로그아웃
  $('#logout-btn').addEventListener('click', async ()=>{ await supabase.auth.signOut(); location.href = 'login.html'; });

  // 페이지 init
  async function initPage(){ if(!await checkAuth()) return; await loadWorks(); }

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
    SHEET_MODE = mode; CURRENT_ID = workId; $S('#sheet-title').textContent = (mode==='create') ? '작품 추가' : '작품 편집';
    resetSheetForm();
    $S('#edit-sheet').classList.add('open');
    $S('#sheet-backdrop').classList.add('open');
    if(mode==='edit' && workId) loadWorkIntoForm(workId);
  }
  function closeSheet(){ $S('#edit-sheet').classList.remove('open'); $S('#sheet-backdrop').classList.remove('open'); }
  window.openSheet = openSheet; // 디버깅용

  $S('#sheet-close').addEventListener('click', closeSheet);
  $S('#sheet-cancel').addEventListener('click', closeSheet);
  $S('#sheet-backdrop').addEventListener('click', closeSheet);
  addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeSheet(); });

  function resetSheetForm(){
    thumbFile = null; galleryItems.length = 0;
    $S('#f-title').value = ''; $S('#f-subtitle').value = '';
    const tp = $S('#thumb-preview'); tp.src=''; tp.style.display='none';
    $S('#gallery-list').innerHTML = '';
  }

  // 대표 이미지
  $S('#btn-thumb').addEventListener('click', ()=> $S('#f-thumb').click());
  $S('#f-thumb').addEventListener('change', (e)=>{ const f = e.target.files?.[0]; if(!f) return; setThumbPreview(f); });
  const thumbDrop = $S('#thumb-drop');
  ;['dragenter','dragover'].forEach(ev => thumbDrop.addEventListener(ev, (e)=>{ e.preventDefault(); thumbDrop.classList.add('dragover'); }));
  ;['dragleave','drop'].forEach(ev => thumbDrop.addEventListener(ev, (e)=>{ e.preventDefault(); thumbDrop.classList.remove('dragover'); }));
  thumbDrop.addEventListener('drop', (e)=>{ const f = e.dataTransfer?.files?.[0]; if(!f) return; setThumbPreview(f); });
  function setThumbPreview(file){ thumbFile = file; const url = URL.createObjectURL(file); const img = $S('#thumb-preview'); img.src = url; img.style.display='block'; }

  // 갤러리
  $S('#btn-gallery').addEventListener('click', ()=> $S('#f-gallery').click());
  $S('#f-gallery').addEventListener('change', (e)=> addGalleryFiles(e.target.files));
  const galDrop = $S('#gallery-drop');
  ;['dragenter','dragover'].forEach(ev => galDrop.addEventListener(ev, (e)=>{ e.preventDefault(); galDrop.classList.add('dragover'); }));
  ;['dragleave','drop'].forEach(ev => galDrop.addEventListener(ev, (e)=>{ e.preventDefault(); galDrop.classList.remove('dragover'); }));
  galDrop.addEventListener('drop', (e)=> addGalleryFiles(e.dataTransfer?.files));

  function addGalleryFiles(fileList){ if(!fileList||!fileList.length) return; [...fileList].forEach(file=>{ galleryItems.push({ file, caption:'', _key: crypto.randomUUID() }); }); renderGallery(); }

  function renderGallery(){
    const ul = $S('#gallery-list'); ul.innerHTML='';
    galleryItems.forEach(it=>{
      const li = document.createElement('li'); li.className='gallery-item'; li.dataset.key = it._key;
      const img = document.createElement('img'); img.className='g-thumb'; img.src = it.url ? it.url : URL.createObjectURL(it.file);
      const cap = document.createElement('input'); cap.type='text'; cap.className='g-cap'; cap.placeholder='캡션(선택)'; cap.value = it.caption||''; cap.addEventListener('input', (e)=> it.caption = e.target.value);
      const handle = document.createElement('button'); handle.className='g-handle'; handle.innerHTML='≡'; handle.title='드래그로 순서 변경';
      const del = document.createElement('button'); del.className='g-del'; del.textContent='삭제'; del.addEventListener('click', ()=>{ const idx = galleryItems.findIndex(x=>x._key===it._key); if(idx>=0) galleryItems.splice(idx,1); renderGallery(); });
      li.append(img, cap, handle, del); ul.appendChild(li);
    });
    if(window.Sortable){ if(renderGallery.sortable) renderGallery.sortable.destroy(); renderGallery.sortable = new Sortable($S('#gallery-list'), { animation:150, handle:'.g-handle', onEnd: ()=>{ const order=[...$S('#gallery-list').children].map(li=>li.dataset.key); galleryItems.sort((a,b)=> order.indexOf(a._key) - order.indexOf(b._key)); } }); }
  }

  // 편집 로드
  async function loadWorkIntoForm(id){
    const { data: work, error: wErr } = await supabase.from('works').select('*').eq('id', id).single();
    if(wErr||!work){ console.error(wErr); return toast('불러오기 실패','error'); }
    $S('#f-title').value = work.title||''; $S('#f-subtitle').value = work.subtitle||'';
    if(work.image_url){ const img = $S('#thumb-preview'); img.src = work.image_url; img.style.display='block'; thumbFile = null; }
    const { data: imgs, error: iErr } = await supabase.from('work_images').select('*').eq('work_id', id).order('order_index', { ascending: true });
    if(iErr){ console.error(iErr); return; }
    galleryItems.length = 0;
    (imgs||[]).forEach(row=> galleryItems.push({ id: row.id, url: row.url, caption: row.caption||'', _key: 'db-'+row.id }));
    renderGallery();
  }

  // 저장
  $S('#sheet-save').addEventListener('click', saveAll);
  addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ if($S('#edit-sheet').classList.contains('open')){ e.preventDefault(); saveAll(); } } });

  async function saveAll(){
    const title = $S('#f-title').value.trim(); const subtitle = $S('#f-subtitle').value.trim();
    if(!title) return Swal.fire({ icon:'warning', title:'제목을 입력해줘!' });
    if(SHEET_MODE==='create' && !thumbFile) return Swal.fire({ icon:'info', title:'대표 이미지를 넣어줘!' });
    showLoading();
    try {
      let workId = CURRENT_ID;
      if(SHEET_MODE==='create'){
        const { data, error } = await supabase.from('works').insert([{ title, subtitle }]).select('id').single();
        if(error) throw error; workId = data.id;
      } else {
        const { error } = await supabase.from('works').update({ title, subtitle }).eq('id', workId);
        if(error) throw error;
      }

      // 대표 이미지 업로드 → works 업데이트 (placeholder는 DB 반영 스킵)
      if(thumbFile){
        const coverUrl = await uploadToR2(thumbFile, `works/${workId}/cover_${Date.now()}.jpg`);
        if(!coverUrl.startsWith('blob:')){
          const { error } = await supabase.from('works').update({ image_url: coverUrl }).eq('id', workId);
          if(error) throw error;
        } else {
          console.warn('blob: URL은 새로고침 시 사라집니다. 실제 업로드 엔드포인트로 교체하세요.');
        }
      }

      // 갤러리 diff
      const { data: dbImgs } = await supabase.from('work_images').select('id').eq('work_id', workId);
      const keepIds = new Set(galleryItems.filter(x=>x.id).map(x=>x.id));
      const toDelete = (dbImgs||[]).map(r=>r.id).filter(id=>!keepIds.has(id));
      if(toDelete.length){ await supabase.from('work_images').delete().in('id', toDelete); }

      for(let i=0;i<galleryItems.length;i++){
        const it = galleryItems[i];
        if(it.file){
          const url = await uploadToR2(it.file, `works/${workId}/gallery_${Date.now()}_${i}.jpg`);
          if(url.startsWith('blob:')){ console.warn('갤러리도 blob: URL은 임시입니다.'); }
          const { error } = await supabase.from('work_images').insert([{ work_id: workId, url, caption: it.caption||'', order_index: i+1 }]);
          if(error) throw error;
        } else if(it.id){
          const { error } = await supabase.from('work_images').update({ caption: it.caption||'', order_index: i+1 }).eq('id', it.id);
          if(error) throw error;
        }
      }

      Swal.fire({ icon:'success', title:'저장 완료!' }); closeSheet(); await loadWorks();
    } catch(e){ console.error(e); Swal.fire({ icon:'error', title:'저장 실패', text: e.message||'오류' }); }
    finally { hideLoading(); }
  }

  // 업로드 훅 (플레이스홀더) → Cloudflare Worker / Supabase Edge Function으로 교체 필요
  async function uploadToR2(file, path){
    // const fd = new FormData(); fd.append('file', file); fd.append('path', path);
    // const res = await fetch('/api/r2-upload', { method:'POST', body: fd });
    // const { url } = await res.json(); return url;
    return URL.createObjectURL(file); // 임시 미리보기 전용
  }

  // 트리거 연결
  document.getElementById('add-work-btn').addEventListener('click', ()=> openSheet('create'));
  // 행 더블클릭 → 편집
  document.addEventListener('dblclick', (e)=>{ const row = e.target.closest('.row'); if(!row) return; openSheet('edit', row.dataset.id); });
  // (선택) 단일 클릭으로도 편집 열기
  // document.addEventListener('click', (e)=>{ if(e.target.closest('.drag')) return; const row = e.target.closest('.row'); if(!row) return; openSheet('edit', row.dataset.id); });

  // 시작
  initPage();
// ===== 안전 가드(중복 로드 방지) =====
if (window.__ADMIN_INIT__) {
  console.warn('admin.js loaded twice — skip');
} else {
  window.__ADMIN_INIT__ = true;

  // ===== Supabase 초기화 =====
  const supabase = window.supabase.createClient(
    'https://feprvneoartflrnmefxz.supabase.co',
    'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
  );

  // ===== Helpers =====
  const $ = (s) => document.querySelector(s);
  const toast = (msg='완료!', icon='success') =>
    Swal.fire({ toast:true, position:'center', icon, title: msg, showConfirmButton:false, timer:1300 });

  function makeSlug(text){
    return (text||'').toString().trim().toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
      .replace(/\s+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'');
  }

  // 로그인 체크
  async function checkAuth(){
    const { data:{ user }, error } = await supabase.auth.getUser();
    if(error || !user){ location.href = 'login.html'; return false; }
    return true;
  }

  // 로딩 오버레이
  function showLoading(){
    const o = $('#loading-overlay'); if(!o) return;
    o.style.display='flex'; requestAnimationFrame(()=>o.classList.add('active'));
  }
  function hideLoading(){
    const o = $('#loading-overlay'); if(!o) return;
    o.classList.remove('active'); setTimeout(()=>{ o.style.display='none'; }, 380);
  }

  /* =========================
   *  R2 업/삭제 HTTP 헬퍼
   * ========================= */
  async function uploadToR2(file, { workId, slug, kind='cover', seq=null }){
    const fd = new FormData();
    fd.append('file', file);
    fd.append('workId', String(workId));
    fd.append('slug', slug);
    fd.append('kind', kind);
    if (kind === 'gallery' && seq != null) fd.append('seq', String(seq));

    const res = await fetch('/r2-upload', { method:'POST', body: fd });
    const json = await res.json();
    if(!res.ok) throw new Error(json.error || '업로드 실패');
    return json.url;
  }

  async function r2Delete({ urls = [], paths = [] } = {}){
    try{
      if(!urls.length && !paths.length) return;
      const res = await fetch('/r2-delete', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ urls, paths })
      });
      if(!res.ok) throw new Error(await res.text());
      const json = await res.json();
      console.log('R2 delete result:', json);
    }catch(e){
      console.warn('R2 삭제 실패(무시):', e);
    }
  }

  // Works 불러오기
  async function loadWorks(){
    const list = $('#works-list'); list.innerHTML = '';
    const { data, error } = await supabase
      .from('works').select('*')
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
          <div class="since">${it.since ? ` ${it.since}` : ''}</div>
        </div>
        <button class="del-work" title="삭제">🗑️</button>`;
      list.appendChild(li);
    });
    initSortable();
  }

  // 행 삭제(이벤트 위임) — R2도 같이 삭제
  $('#works-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.del-work'); if(!btn) return;
    const li = btn.closest('.row'); if(!li) return;
    const id = li.dataset.id;

    const res = await Swal.fire({
      title: '정말 삭제할끼?',
      text: '신중하게 하라냥.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '삭제',
      cancelButtonText: '취소'
    });
    if(!res.isConfirmed) return;

    showLoading();
    try{
      // 삭제 대상 URL 수집
      const { data: workRow }  = await supabase.from('works').select('image_url').eq('id', id).single();
      const { data: imgsRows } = await supabase.from('images').select('image_url').eq('work_id', id);
      const delUrls = [
        ...(workRow?.image_url ? [workRow.image_url] : []),
        ...((imgsRows||[]).map(r=>r.image_url).filter(Boolean))
      ];

      // R2 먼저 삭제
      await r2Delete({ urls: delUrls });

      // DB 삭제
      const { error: delImgsErr } = await supabase.from('images').delete().eq('work_id', id);
      if(delImgsErr) throw delImgsErr;
      const { error } = await supabase.from('works').delete().eq('id', id);
      if(error) throw error;

      await loadWorks();
      toast('삭제 완료','success');
    }catch(err){
      console.error('삭제 실패', err);
      Swal.fire({ icon:'error', title:'삭제 실패', text: err.message||'' });
    }finally{
      hideLoading();
    }
  });

  // Sortable (행)
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

  // ✅ 순서 저장 (동시 사용자 충돌 방지: 서버 함수로 원자적 처리)
  async function persistOrderFromDOM(){
    const rows = Array.from($('#works-list').querySelectorAll('.row'));
    const updates = rows.map((row, i) => ({ id: Number(row.dataset.id), idx: i+1 }));
    // 하나의 트랜잭션으로 처리
    const { error } = await supabase.rpc('reorder_works', { arr: updates });
    if(error) throw error;
  }

  $('#save-order').addEventListener('click', async()=>{
    showLoading();
    try{
      await persistOrderFromDOM();
      toast('순서 저장 완료','success');
    }catch(e){
      console.error('순서 저장 실패', e);
      toast('순서 저장 실패','error');
    }finally{
      hideLoading();
    }
  });

  // 로그아웃
  $('#logout-btn').addEventListener('click', async ()=>{
    await supabase.auth.signOut();
    location.href = 'login.html';
  });

  // 페이지 init
  async function initPage(){ if(!await checkAuth()) return; await loadWorks(); }

  /* =========================
   *  Sheet (등록/수정)
   * ========================= */
  let SHEET_MODE = 'create';
  let CURRENT_ID = null;
  let thumbFile = null;
  const galleryItems = [];  // { id?, url?, file?, _key }
  const $S = (s) => document.querySelector(s);
  let IS_SAVING = false;

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
  window.openSheet = openSheet;

  $S('#sheet-close').addEventListener('click', closeSheet);
  $S('#sheet-cancel').addEventListener('click', closeSheet);
  $S('#sheet-backdrop').addEventListener('click', closeSheet);
  addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeSheet(); });

  function resetSheetForm(){
    thumbFile = null; galleryItems.length = 0;
    $S('#f-title').value = ''; $S('#f-subtitle').value = ''; $S('#f-since').value='';
    const tp = $S('#thumb-preview'); tp.src=''; tp.style.display='none';
    $S('#gallery-list').innerHTML = '';
  }

  // 대표 이미지
  $S('#btn-thumb').addEventListener('click', ()=> $S('#f-thumb').click());
  $S('#f-thumb').addEventListener('change', (e)=>{
    const f = e.target.files?.[0]; if(!f) return; setThumbPreview(f);
  });
  const thumbDrop = $S('#thumb-drop');
  ;['dragenter','dragover'].forEach(ev =>
    thumbDrop.addEventListener(ev, (e)=>{ e.preventDefault(); thumbDrop.classList.add('dragover'); })
  );
  ;['dragleave','drop'].forEach(ev =>
    thumbDrop.addEventListener(ev, (e)=>{ e.preventDefault(); thumbDrop.classList.remove('dragover'); })
  );
  thumbDrop.addEventListener('drop', (e)=>{
    const f = e.dataTransfer?.files?.[0]; if(!f) return; setThumbPreview(f);
  });
  function setThumbPreview(file){
    thumbFile = file;
    const url = URL.createObjectURL(file);
    const img = $S('#thumb-preview'); img.src = url; img.style.display='block';
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
    [...fileList].forEach(file=> galleryItems.push({ file, _key: crypto.randomUUID() }));
    renderGallery();
  }

  function renderGallery(){
    const ul = $S('#gallery-list'); ul.innerHTML='';
    galleryItems.forEach(it=>{
      const li = document.createElement('li'); li.className='gallery-item'; li.dataset.key = it._key;
      const img = document.createElement('img'); img.className='g-thumb';
      img.src = it.url ? it.url : URL.createObjectURL(it.file);
      const handle = document.createElement('button'); handle.className='g-handle'; handle.innerHTML='≡'; handle.title='드래그로 순서 변경';
      const del = document.createElement('button'); del.className='g-del'; del.textContent='삭제';
      del.addEventListener('click', ()=>{
        const idx = galleryItems.findIndex(x=>x._key===it._key);
        if(idx>=0) galleryItems.splice(idx,1);
        renderGallery();
      });
      li.append(img, handle, del);
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

    $S('#f-title').value   = work.title||'';
    $S('#f-subtitle').value= work.subtitle||'';
    $S('#f-since').value   = work.since||'';
    if(work.image_url){
      const img = $S('#thumb-preview'); img.src = work.image_url; img.style.display='block'; thumbFile = null;
    }

    const { data: imgs, error: iErr } = await supabase
      .from('images')
      .select('*')
      .eq('work_id', id)
      .order('images_order_index', { ascending: true });

    if(iErr){ console.error(iErr); return; }

    galleryItems.length = 0;
    (imgs||[]).forEach(row => galleryItems.push({ id: row.id, url: row.image_url, _key: 'db-'+row.id }));
    renderGallery();
  }

  // 저장
  $S('#sheet-save').addEventListener('click', saveAll);
  addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){
      if($S('#edit-sheet').classList.contains('open')){ e.preventDefault(); saveAll(); }
    }
  });

  async function saveAll(){
    if(IS_SAVING) return; IS_SAVING = true;
    const saveBtn = $('#sheet-save');
    if(saveBtn){ saveBtn.disabled = true; saveBtn.classList.add('disabled'); }

    const title    = $S('#f-title').value.trim();
    const subtitle = $S('#f-subtitle').value.trim();
    const since    = $S('#f-since').value.trim();

    if(!title){
      if(saveBtn){ saveBtn.disabled=false; saveBtn.classList.remove('disabled'); }
      IS_SAVING=false; return Swal.fire({ icon:'warning', title:'제목을 입력해줘!' });
    }
    if(SHEET_MODE==='create' && !thumbFile){
      if(saveBtn){ saveBtn.disabled=false; saveBtn.classList.remove('disabled'); }
      IS_SAVING=false; return Swal.fire({ icon:'info', title:'대표 이미지를 넣어줘!' });
    }

    showLoading();
    try{
      let workId = CURRENT_ID;

      // works 생성/업데이트
      if(SHEET_MODE==='create'){
        const { data: maxRows } = await supabase
          .from('works').select('works_order_index').order('works_order_index',{ascending:false}).limit(1);

        let maxIndex = 0;
        if(Array.isArray(maxRows) && maxRows.length && typeof maxRows[0].works_order_index==='number'){
          maxIndex = maxRows[0].works_order_index;
        }

        const { data, error } = await supabase
          .from('works')
          .insert([{ title, subtitle, since, works_order_index: maxIndex+1 }])
          .select('id').single();
        if(error) throw error;
        workId = data.id;

        SHEET_MODE = 'edit';
        CURRENT_ID = workId;
      }else{
        const { error } = await supabase.from('works').update({ title, subtitle, since }).eq('id', workId);
        if(error) throw error;
      }

      const slug = makeSlug(subtitle || title) || 'untitled';

      // 대표 이미지 업로드 (이전 커버 정리)
      let oldCoverUrl = null;
      if(SHEET_MODE==='edit'){
        const { data: old } = await supabase.from('works').select('image_url').eq('id', workId).single();
        oldCoverUrl = old?.image_url || null;
      }
      if(thumbFile){
        const coverUrl = await uploadToR2(thumbFile, { workId, slug, kind:'cover' });
        const { error } = await supabase.from('works').update({ image_url: coverUrl }).eq('id', workId);
        if(error) throw error;
        if(oldCoverUrl && oldCoverUrl !== coverUrl) await r2Delete({ urls:[oldCoverUrl] });
      }

      // 갤러리 diff (삭제 → R2삭제 포함)
      const { data: dbImgs } = await supabase.from('images').select('id,image_url').eq('work_id', workId);
      const keepIds  = new Set(galleryItems.filter(x=>x.id).map(x=>x.id));
      const toDelete = (dbImgs||[]).map(r=>r.id).filter(id=>!keepIds.has(id));
      if(toDelete.length){
        const delUrls = (dbImgs||[]).filter(r=>toDelete.includes(r.id)).map(r=>r.image_url).filter(Boolean);
        if(delUrls.length) await r2Delete({ urls: delUrls });
        await supabase.from('images').delete().in('id', toDelete);
      }

      // 갤러리 추가/수정
      for(let i=0; i<galleryItems.length; i++){
        const it = galleryItems[i];
        const orderIdx = i+1;

        if(it.file){
          // 1) 비어있는 행을 먼저 insert (seq는 트리거가 자동배정)
          const { data: ins, error: insErr } = await supabase
            .from('images')
            .insert([{ work_id: workId, images_order_index: orderIdx }])
            .select('id, seq').single();
          if(insErr) throw insErr;

          // 2) 돌아온 seq로 파일 업로드 → 파일명 충돌 방지
          const url = await uploadToR2(it.file, { workId, slug, kind:'gallery', seq: ins.seq });

          // 3) 해당 행 URL 업데이트
          const { error: upErr } = await supabase
            .from('images')
            .update({ image_url: url, images_order_index: orderIdx })
            .eq('id', ins.id);
          if(upErr) throw upErr;

          // 메모리에 id/url 채워두기(이후 재정렬 RPC에 사용)
          it.id  = ins.id;
          it.url = url;

        }else if(it.id){
          // 기존 행은 순서만 갱신
          const { error } = await supabase
            .from('images')
            .update({ images_order_index: orderIdx })
            .eq('id', it.id);
          if(error) throw error;
        }
      }

      // (선택/권장) 이미지 순서도 서버 함수로 원자적 재정렬
      const arr = galleryItems.filter(x=>x.id).map((x,i)=>({ id: x.id, idx: i+1 }));
      if(arr.length){
        const { error } = await supabase.rpc('reorder_images', { p_work_id: CURRENT_ID, arr });
        if(error) throw error;
      }

      toast('저장 완료!','success');
      closeSheet();
      await loadWorks();
    }catch(e){
      console.error(e);
      Swal.fire({ icon:'error', title:'저장 실패', text:e.message||'오류' });
    }finally{
      hideLoading();
      IS_SAVING=false;
      if(saveBtn){ saveBtn.disabled=false; saveBtn.classList.remove('disabled'); }
    }
  }

  // 트리거 연결
  $('#add-work-btn').addEventListener('click', ()=> openSheet('create'));
  document.addEventListener('dblclick', (e)=>{
    const row = e.target.closest('.row'); if(!row) return;
    openSheet('edit', row.dataset.id);
  });

  // 시작!
  initPage();
}
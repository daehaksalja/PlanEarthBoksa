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

  const $S = (s) => document.querySelector(s);
  function makeSlug(t){
    return (t||'').toString().trim().toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]+/gu,'')
      .replace(/\s+/g,'_')
      .replace(/_+/g,'_')
      .replace(/^_+|_+$/g,'');
  }

  // ✅ 영문란에서 '한글만' 차단 (붙여넣기/IME 포함 안전 처리)
  function enforceNoHangul(input) {
    if (!input) return;

    // UX 힌트(모바일 키보드 등)
    input.setAttribute('inputmode', 'latin');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('lang', 'en');

    let composing = false;
    const HANGUL_REGEX = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3\uA960-\uA97F\uD7B0-\uD7FF]/g; // 자모/완성형 전부

    const sanitize = () => {
      const v = input.value || '';
      const cleaned = v.replace(HANGUL_REGEX, '');
      if (v !== cleaned) {
        input.value = cleaned;
        // 첫 위반에만 안내
        if (!input.dataset.warnedOnce) {
          input.dataset.warnedOnce = '1';
          toast('이 입력란에는 한글을 넣을 수 없어요.', 'info');
        }
      }
    };

    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; sanitize(); });
    input.addEventListener('input', () => { if (!composing) sanitize(); });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      const cleaned = text.replace(HANGUL_REGEX, '');
      // execCommand 미지원 브라우저 대비
      const { selectionStart, selectionEnd, value } = input;
      input.value = value.slice(0, selectionStart) + cleaned + value.slice(selectionEnd);
      const pos = selectionStart + cleaned.length;
      input.setSelectionRange(pos, pos);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  // 로그인 체크
  async function checkAuth(){
    const { data:{ user }, error } = await supabase.auth.getUser();
    if (error || !user) { location.href='login.html'; return false; }
    return true;
  }

  // 로딩 오버레이 (즉시 페인트)
  function showLoading(){
    const o = $('#loading-overlay'); if(!o) return;
    o.style.display='flex'; void o.offsetHeight; o.classList.add('active');
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
    if (kind==='gallery' && seq!=null) fd.append('seq', String(seq));

    const res = await fetch('/r2-upload', { method:'POST', body: fd });
    const json = await res.json();
    if(!res.ok) throw new Error(json.error || '업로드 실패');
    return json.url;
  }

  async function r2Delete({ urls=[], paths=[] }={}){
    try{
      if(!urls.length && !paths.length) return;
      const res = await fetch('/r2-delete', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ urls, paths })
      });
      if(!res.ok) throw new Error(await res.text());
      await res.json();
    }catch(e){ console.warn('R2 삭제 실패(무시):', e); }
  }

  /* =========================
   *  목록 화면
   * ========================= */
  async function loadWorks(){
    const list = $('#works-list'); list.innerHTML = '';
    const { data, error } = await supabase.from('works').select('*').order('works_order_index',{ascending:true});
    if(error){ console.error(error); return toast('불러오기 실패','error'); }

    (data||[]).forEach((it,i)=>{
      const li = document.createElement('li'); li.className='row'; li.dataset.id = it.id;
      li.innerHTML = `
        <div class="idx">${i+1}</div>
        <button class="drag" title="드래그로 순서 변경">≡</button>
        <img class="thumb" src="${it.image_url||''}" alt="" draggable="false">
        <div class="meta">
          <div class="title">${it.title||''}</div>
          <div class="sub">${it.subtitle||''}</div>
          <div class="since">${it.since||''}</div>
        </div>
        <button class="del-work" title="삭제">🗑️</button>`;
      list.appendChild(li);
    });
    initSortable();
  }

  // 행 삭제(이벤트 위임)
  $('#works-list').addEventListener('click', async (e)=>{
    const btn = e.target.closest('.del-work'); if(!btn) return;
    const li  = btn.closest('.row'); if(!li) return;
    const id  = li.dataset.id;

    const res = await Swal.fire({
      title:'정말 삭제할끼?', text:'신중하게 하라냥.', icon:'warning',
      showCancelButton:true, confirmButtonText:'삭제', cancelButtonText:'취소'
    });
    if(!res.isConfirmed) return;

    showLoading();
    try{
      const { data: workRow }  = await supabase.from('works').select('image_url').eq('id', id).single();
      const { data: imgsRows } = await supabase.from('images').select('image_url').eq('work_id', id);
      const delUrls = [
        ...(workRow?.image_url ? [workRow.image_url] : []),
        ...((imgsRows||[]).map(r=>r.image_url).filter(Boolean))
      ];
      await r2Delete({ urls: delUrls });

      const { error: e1 } = await supabase.from('images').delete().eq('work_id', id);
      if(e1) throw e1;
      const { error: e2 } = await supabase.from('works').delete().eq('id', id);
      if(e2) throw e2;

      await loadWorks();
      toast('삭제 완료','success');
    }catch(err){
      console.error(err);
      Swal.fire({ icon:'error', title:'삭제 실패', text: err.message||'' });
    }finally{ hideLoading(); }
  });

  // Sortable
  let sortable;
  function initSortable(){
    const list = $('#works-list'); if(sortable) sortable.destroy();
    sortable = new Sortable(list, {
      handle:'.drag', animation:180, ghostClass:'ghost',
      chosenClass:'chosen', dragClass:'dragging', forceFallback:true,
      fallbackOnBody:true, fallbackTolerance:5, scroll:true, scrollSensitivity:60, scrollSpeed:12,
      onEnd: ()=> $('#works-list').querySelectorAll('.row .idx').forEach((el,i)=> el.textContent = i+1)
    });
  }

  // 목록 순서 저장(RPC, 로딩 최소 노출)
  async function persistOrderFromDOM(){
    const rows = Array.from($('#works-list').querySelectorAll('.row'));
    const updates = rows.map((row,i)=>({ id:Number(row.dataset.id), idx:i+1 }));
    const { error } = await supabase.rpc('reorder_works', { arr: updates });
    if(error) throw error;
  }
  document.getElementById('save-order').addEventListener('click', async ()=>{
    const btn = document.getElementById('save-order');
    btn.disabled = true; showLoading();
    const started = performance.now();
    try{
      await persistOrderFromDOM();
      const min = 450; const elapsed = performance.now()-started;
      if(elapsed < min) await new Promise(r=>setTimeout(r, min-elapsed));
      toast('순서 저장 완료','success');
    }catch(e){ console.error(e); toast('순서 저장 실패','error'); }
    finally{ hideLoading(); btn.disabled=false; }
  });

  // 로그아웃
  $('#logout-btn').addEventListener('click', async ()=>{
    await supabase.auth.signOut(); location.href='login.html';
  });

  // init
  async function initPage(){ if(!await checkAuth()) return; await loadWorks(); }

  /* =========================
   *  Sheet (등록/수정)
   * ========================= */
  let SHEET_MODE='create', CURRENT_ID=null, thumbFile=null, IS_SAVING=false;
  const galleryItems=[]; // { id?, url?, file?, _key }

  function openSheet(mode='create', workId=null){
    SHEET_MODE=mode; CURRENT_ID=workId;
    $S('#sheet-title').textContent = (mode==='create')?'춘식이 추가':'춘식이 편집';
    resetSheetForm();
    $S('#edit-sheet').classList.add('open');
    $S('#sheet-backdrop').classList.add('open');
    if(mode==='edit' && workId) loadWorkIntoForm(workId);
  }
  function closeSheet(){ $S('#edit-sheet').classList.remove('open'); $S('#sheet-backdrop').classList.remove('open'); }
  window.openSheet = openSheet;

  $S('#sheet-close').addEventListener('click', closeSheet);
  $S('#sheet-cancel').addEventListener('click', closeSheet);
  $S('#sheet-backdrop').addEventListener('click', closeSheet);
  addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeSheet(); });

  function resetSheetForm(){
    thumbFile=null; galleryItems.length=0;
    $S('#f-title').value=''; $S('#f-subtitle').value=''; $S('#f-since').value='';
    const tp=$S('#thumb-preview'); tp.src=''; tp.style.display='none';
    $S('#gallery-list').innerHTML='';
  }

  // 대표 이미지
  $S('#btn-thumb').addEventListener('click', ()=> $S('#f-thumb').click());
  $S('#f-thumb').addEventListener('change', (e)=>{ const f=e.target.files?.[0]; if(!f) return; setThumbPreview(f); });
  const thumbDrop=$S('#thumb-drop');
  ['dragenter','dragover'].forEach(ev=>thumbDrop.addEventListener(ev,(e)=>{e.preventDefault(); thumbDrop.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev=>thumbDrop.addEventListener(ev,(e)=>{e.preventDefault(); thumbDrop.classList.remove('dragover');}));
  thumbDrop.addEventListener('drop',(e)=>{ const f=e.dataTransfer?.files?.[0]; if(!f) return; setThumbPreview(f); });
  function setThumbPreview(file){ thumbFile=file; const url=URL.createObjectURL(file); const img=$S('#thumb-preview'); img.src=url; img.style.display='block'; }

  // 갤러리
  $S('#btn-gallery').addEventListener('click', ()=> $S('#f-gallery').click());
  $S('#f-gallery').addEventListener('change',(e)=> addGalleryFiles(e.target.files));
  const galDrop=$S('#gallery-drop');
  ['dragenter','dragover'].forEach(ev=>galDrop.addEventListener(ev,(e)=>{e.preventDefault(); galDrop.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev=>galDrop.addEventListener(ev,(e)=>{e.preventDefault(); galDrop.classList.remove('dragover');}));
  galDrop.addEventListener('drop',(e)=> addGalleryFiles(e.dataTransfer?.files));

  function addGalleryFiles(fileList){
    if(!fileList||!fileList.length) return;
    [...fileList].forEach(file=> galleryItems.push({ file, _key: crypto.randomUUID() }));
    renderGallery();
  }

  function renderGallery(){
    const ul=$S('#gallery-list'); ul.innerHTML='';
    galleryItems.forEach(it=>{
      const li=document.createElement('li'); li.className='gallery-item'; li.dataset.key=it._key;
      const img=document.createElement('img'); img.className='g-thumb'; img.src= it.url?it.url:URL.createObjectURL(it.file);
      const handle=document.createElement('button'); handle.className='g-handle'; handle.innerHTML='≡'; handle.title='드래그로 순서 변경';
      const del=document.createElement('button'); del.className='g-del'; del.textContent='삭제';
      del.addEventListener('click', ()=>{ const idx=galleryItems.findIndex(x=>x._key===it._key); if(idx>=0) galleryItems.splice(idx,1); renderGallery(); });
      li.append(img, handle, del); ul.appendChild(li);
    });

    if(window.Sortable){
      if(renderGallery.sortable) renderGallery.sortable.destroy();
      renderGallery.sortable = new Sortable($S('#gallery-list'),{
        animation:150, handle:'.g-handle',
        onEnd:()=>{ const order=[...$S('#gallery-list').children].map(li=>li.dataset.key);
          galleryItems.sort((a,b)=> order.indexOf(a._key)-order.indexOf(b._key)); }
      });
    }
  }

  // 편집 로드
  async function loadWorkIntoForm(id){
    const { data: work, error: wErr } = await supabase.from('works').select('*').eq('id', id).single();
    if(wErr||!work){ console.error(wErr); return toast('불러오기 실패','error'); }

    $S('#f-title').value=work.title||'';
    $S('#f-subtitle').value=work.subtitle||'';
    $S('#f-since').value=work.since||'';
    if(work.image_url){ const img=$S('#thumb-preview'); img.src=work.image_url; img.style.display='block'; thumbFile=null; }

    const { data: imgs, error: iErr } = await supabase
      .from('images').select('*').eq('work_id', id).order('images_order_index',{ascending:true});
    if(iErr){ console.error(iErr); return; }

    galleryItems.length=0;
    (imgs||[]).forEach(row => galleryItems.push({ id: row.id, url: row.image_url, _key: 'db-'+row.id }));
    renderGallery();
  }

  // 저장
  $S('#sheet-save').addEventListener('click', saveAll);
  addEventListener('keydown',(e)=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
      if($S('#edit-sheet').classList.contains('open')){ e.preventDefault(); saveAll(); }
    }
  });

  async function saveAll(){
    if(IS_SAVING) return; IS_SAVING=true;
    const saveBtn=$('#sheet-save'); if(saveBtn){ saveBtn.disabled=true; saveBtn.classList.add('disabled'); }

    const title=$S('#f-title').value.trim();
    const subtitle=$S('#f-subtitle').value.trim();
    const since=$S('#f-since').value.trim();

    if(!title){
      if(saveBtn){saveBtn.disabled=false; saveBtn.classList.remove('disabled');}
      IS_SAVING=false; return Swal.fire({icon:'warning', title:'제목을 입력해줘!'});
    }
    if(SHEET_MODE==='create' && !thumbFile){
      if(saveBtn){saveBtn.disabled=false; saveBtn.classList.remove('disabled');}
      IS_SAVING=false; return Swal.fire({icon:'info', title:'대표 이미지를 넣어줘!'});
    }

    showLoading();
    try{
      let workId = CURRENT_ID;

      // works 생성/수정
      if(SHEET_MODE==='create'){
        const { data:maxRows } = await supabase.from('works').select('works_order_index').order('works_order_index',{ascending:false}).limit(1);
        let maxIndex = (Array.isArray(maxRows)&&maxRows.length&&typeof maxRows[0].works_order_index==='number') ? maxRows[0].works_order_index : 0;
        const { data, error } = await supabase.from('works').insert([{ title, subtitle, since, works_order_index: maxIndex+1 }]).select('id').single();
        if(error) throw error;
        workId = data.id; SHEET_MODE='edit'; CURRENT_ID=workId;
      }else{
        const { error } = await supabase.from('works').update({ title, subtitle, since }).eq('id', workId);
        if(error) throw error;
      }

      const slug = makeSlug(subtitle||title)||'untitled';

      // 대표 이미지 (기존 정리)
      let oldCoverUrl=null;
      if(SHEET_MODE==='edit'){ const { data:old } = await supabase.from('works').select('image_url').eq('id', workId).single(); oldCoverUrl=old?.image_url||null; }
      if(thumbFile){
        const coverUrl = await uploadToR2(thumbFile, { workId, slug, kind:'cover' });
        const { error } = await supabase.from('works').update({ image_url: coverUrl }).eq('id', workId);
        if(error) throw error;
        if(oldCoverUrl && oldCoverUrl!==coverUrl) await r2Delete({ urls:[oldCoverUrl] });
      }

      // 갤러리: 삭제된 것 정리 (R2 포함)
      const { data: dbImgs } = await supabase.from('images').select('id,image_url').eq('work_id', workId);
      const keepIds = new Set(galleryItems.filter(x=>x.id).map(x=>x.id));
      const toDelete = (dbImgs||[]).map(r=>r.id).filter(id=>!keepIds.has(id));
      if(toDelete.length){
        const delUrls = (dbImgs||[]).filter(r=>toDelete.includes(r.id)).map(r=>r.image_url).filter(Boolean);
        if(delUrls.length) await r2Delete({ urls: delUrls });
        await supabase.from('images').delete().in('id', toDelete);
      }

      // 갤러리: 새 항목 INSERT -> 업로드 -> URL 업데이트
      for(const it of galleryItems){
        if(!it.file) continue;

        // 1) placeholder insert (order_index = NULL) => seq 자동 배정(트리거)
        const { data: ins, error: insErr } = await supabase
          .from('images')
          .insert([{ work_id: workId, image_url: null, images_order_index: null }])
          .select('id, seq').single();
        if(insErr) throw insErr;

        // 2) seq 기반 파일명으로 업로드(충돌 없음)
        const url = await uploadToR2(it.file, { workId, slug, kind:'gallery', seq: ins.seq });

        // 3) URL 세팅
        const { error: upErr } = await supabase.from('images').update({ image_url: url }).eq('id', ins.id);
        if(upErr) throw upErr;

        it.id = ins.id; it.url = url; delete it.file;
      }

      // 최종 순서 == 화면 순서대로 id 배열
      const orderArr = galleryItems.filter(x=>x.id).map((x,i)=>({ id:x.id, idx:i+1 }));

      // 원자적 재정렬
      if(orderArr.length){
        const { error } = await supabase.rpc('reorder_images', { p_work_id: workId, arr: orderArr });
        if(error) throw error;
      }

      toast('저장 완료!','success');
      closeSheet();
      await loadWorks();
    }catch(e){
      console.error(e);
      Swal.fire({ icon:'error', title:'저장 실패', text:e.message||'오류' });
    }finally{
      hideLoading(); IS_SAVING=false;
      const b=$('#sheet-save'); if(b){ b.disabled=false; b.classList.remove('disabled'); }
    }
  }

  // 트리거
  $('#add-work-btn').addEventListener('click', ()=> openSheet('create'));
  document.addEventListener('dblclick',(e)=>{ const row=e.target.closest('.row'); if(!row) return; openSheet('edit', row.dataset.id); });

  // 시작!
  initPage();

  // ✅ 영문 전용 입력란(#f-subtitle)에서 '한글'만 차단
  enforceNoHangul($S('#f-subtitle'));
}

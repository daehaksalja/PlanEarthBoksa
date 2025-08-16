
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

  // ===== 배포 큐 (Cloudflare Pages Functions 프록시 호출) =====
  // 클라이언트에 Hook URL 노출 금지! /deploy 로만 POST
  let __deployTimer = null;
  async function __triggerDeploy(reason = 'update') {
    try {
      const res = await fetch('/deploy', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('deploy queue failed');
      console.log('[deploy] queued:', reason);
      // toast('배포 요청 전송됨', 'success');
    } catch (e) {
      console.warn('[deploy] queue fail:', e);
      // toast('배포 요청 실패', 'error');
    }
  }
  function queueDeploy(reason = 'update') {
    clearTimeout(__deployTimer);
    __deployTimer = setTimeout(() => __triggerDeploy(reason), 2000);
  }

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

  // 로그인 체크
  async function checkAuth(){
    const { data:{ user }, error } = await supabase.auth.getUser();
    if (error || !user) { location.href='login.html'; return false; }
    return true;
  }

  // 로딩 오버레이
  function showLoading(){ const o = $('#loading-overlay'); if(!o) return; o.style.display='flex'; void o.offsetHeight; o.classList.add('active'); }
  function hideLoading(){ const o = $('#loading-overlay'); if(!o) return; o.classList.remove('active'); setTimeout(()=>{ o.style.display='none'; }, 380); }

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

    const res = await fetch('/r2-upload', { method:'POST', body: fd, credentials: 'include' });
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
        body: JSON.stringify({ urls, paths }),
        credentials: 'include'
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

  // 삭제 + 글로벌 undo bar
  const PENDING_DELETES = new Map(); // id -> { timer, workRow, imgsRows, delUrls, countTimer, started }
  const UNDO_WINDOW_MS = 8000;

  function ensureUndoBar(){
    let bar = document.getElementById('undo-bar');
    if(!bar){
      bar = document.createElement('div');
      bar.id='undo-bar';
      bar.innerHTML = `
        <div class="u-left">
          <div class="u-icon">🗑</div>
        </div>
        <div class="u-body">
          <div class="u-msg"><span class="u-title"></span> <span class="u-sub">삭제됨</span></div>
          <div class="u-meta">되돌리기 가능 · <span class="u-count"></span>s</div>
          <div class="u-prog-wrap"><div class="u-prog"></div></div>
        </div>
        <div class="u-actions">
          <button class="u-undo">되돌리기</button>
          <button class="u-close" title="닫기">✕</button>
        </div>
      `;
      document.body.appendChild(bar);
      bar.querySelector('.u-close').addEventListener('click', ()=> bar.classList.remove('show'));
    }
    return bar;
  }

  function showUndo(id){
    const entry = PENDING_DELETES.get(id); if(!entry) return;
    const bar = ensureUndoBar();
    const titleEl = bar.querySelector('.u-title');
    const countEl = bar.querySelector('.u-count');
    const undoBtn = bar.querySelector('.u-undo');
    const prog = bar.querySelector('.u-prog');

    titleEl.textContent = entry.workRow?.title || '항목';
    const totalSec = Math.ceil(UNDO_WINDOW_MS/1000);
    countEl.textContent = totalSec;

    let remain = UNDO_WINDOW_MS;
    function tick(){
      remain -= 1000;
      if(remain <= 0){ countEl.textContent = 0; prog.style.width = '0%'; return; }
      const sec = Math.ceil(remain/1000);
      countEl.textContent = sec;
      const pct = Math.max(0, Math.min(100, (remain/UNDO_WINDOW_MS)*100));
      prog.style.width = pct + '%';
      entry.countTimer = setTimeout(tick,1000);
    }
    clearTimeout(entry.countTimer);
    prog.style.transition = 'width 1s linear';
    prog.style.width = '100%';
    entry.countTimer = setTimeout(tick,1000);
    undoBtn.onclick = ()=> undoDelete(id);
    bar.classList.add('show');
  }

  async function finalizeDelete(id){
    const entry = PENDING_DELETES.get(id); if(!entry) return;
    try{
      await r2Delete({ urls: entry.delUrls });
      const { error: e1 } = await supabase.from('images').delete().eq('work_id', id); if(e1) throw e1;
      const { error: e2 } = await supabase.from('works').delete().eq('id', id); if(e2) throw e2;
      // ✅ 실제 삭제가 끝난 시점에만 배포 훅
      queueDeploy('work deleted');
    }catch(err){ console.warn('최종 삭제 실패(무시)', err); }
    finally{
      PENDING_DELETES.delete(id);
      const bar = document.getElementById('undo-bar'); if(bar) bar.classList.remove('show');
      try{ Swal.close(); }catch(e){}
    }
  }

  function undoDelete(id){
    const entry = PENDING_DELETES.get(id); if(!entry) return;
    clearTimeout(entry.timer); clearTimeout(entry.countTimer);
    try{ Swal.close(); }catch(e){}
    const bar = document.getElementById('undo-bar'); if(bar) bar.classList.remove('show');
    loadWorks();
    PENDING_DELETES.delete(id);
    toast('삭제 취소됨','info');
  }

  $('#works-list').addEventListener('click', async (e)=>{
    const btn = e.target.closest('.del-work'); if(!btn) return;
    const row = btn.closest('.row'); if(!row) return;
    const id = row.dataset.id;
    if(PENDING_DELETES.has(id)) return;

    const res = await Swal.fire({ title:'삭제ㄱㄱ?', text:'다시 확인하시오', icon:'warning', showCancelButton:true, confirmButtonText:'삭제', cancelButtonText:'취소' });
    if(!res.isConfirmed) return;

    // 원본 데이터 확보
    let workRow, imgsRows;
    try {
      const wq = await supabase.from('works').select('*').eq('id', id).single(); workRow = wq.data;
      const iq = await supabase.from('images').select('*').eq('work_id', id); imgsRows = iq.data || [];
    } catch(err){ return Swal.fire({ icon:'error', title:'삭제 실패', text:'데이터 조회 오류' }); }

    // 즉시 목록에서 제거 (시각적)
    row.remove();
    toast('삭제됨','info');

    const delUrls = [ ...(workRow?.image_url ? [workRow.image_url] : []), ...imgsRows.map(r=>r.image_url).filter(Boolean) ];
    const timer = setTimeout(()=> finalizeDelete(id), UNDO_WINDOW_MS);
    PENDING_DELETES.set(id, { workRow, imgsRows, delUrls, timer, started: Date.now() });
    showUndo(id);
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
    const updates = rows
      .filter(r=>!r.dataset.deleting)
      .map((row,i)=>({ id:Number(row.dataset.id), idx:i+1 }));
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
      queueDeploy('works order updated');
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

    $S('#f-title').value=work.title||''; $S('#f-subtitle').value=work.subtitle||''; $S('#f-since').value=work.since||'';
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
  addEventListener('keydown',(e)=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){ if($S('#edit-sheet').classList.contains('open')){ e.preventDefault(); saveAll(); }}});

  async function saveAll(){
    if(IS_SAVING) return; IS_SAVING=true;
    const saveBtn=$('#sheet-save'); if(saveBtn){ saveBtn.disabled=true; saveBtn.classList.add('disabled'); }

    const title=$S('#f-title').value.trim();
    const subtitle=$S('#f-subtitle').value.trim();
    const since=$S('#f-since').value.trim();

    if(!title){ if(saveBtn){saveBtn.disabled=false;saveBtn.classList.remove('disabled');} IS_SAVING=false; return Swal.fire({icon:'warning', title:'제목을 입력해줘!'}); }
    if(SHEET_MODE==='create' && !thumbFile){ if(saveBtn){saveBtn.disabled=false;saveBtn.classList.remove('disabled');} IS_SAVING=false; return Swal.fire({icon:'info', title:'대표 이미지를 넣어줘!'}); }

    showLoading();
    // 롤백 추적
    let createdWorkId = null;
    const uploadedUrls = [];
    try{
      let workId = CURRENT_ID;

      // works 생성/수정
      if(SHEET_MODE==='create'){
        const { data:maxRows } = await supabase.from('works').select('works_order_index').order('works_order_index',{ascending:false}).limit(1);
        let maxIndex = (Array.isArray(maxRows)&&maxRows.length&&typeof maxRows[0].works_order_index==='number') ? maxRows[0].works_order_index : 0;
        const { data, error } = await supabase.from('works').insert([{ title, subtitle, since, works_order_index: maxIndex+1 }]).select('id').single();
        if(error) throw error;
        workId = data.id; SHEET_MODE='edit'; CURRENT_ID=workId; createdWorkId = workId;
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
        const oldBase = oldCoverUrl ? oldCoverUrl.split('?')[0] : null;
        const newBase = coverUrl; // r2-upload 반환값은 query 없음
        let finalUrl = coverUrl;
        if(oldBase && oldBase === newBase){
          finalUrl = `${coverUrl}?v=${Date.now()}`;
        }
        const { error } = await supabase.from('works').update({ image_url: finalUrl }).eq('id', workId);
        if(error) throw error;
        if(oldBase && oldBase !== newBase){
          await r2Delete({ urls:[oldCoverUrl] });
        }
        uploadedUrls.push(coverUrl);
      }

      // 갤러리: 삭제된 것 정리
      const { data: dbImgs } = await supabase.from('images').select('id,image_url').eq('work_id', workId);
      const keepIds = new Set(galleryItems.filter(x=>x.id).map(x=>x.id));
      const toDelete = (dbImgs||[]).map(r=>r.id).filter(id=>!keepIds.has(id));
      if(toDelete.length){
        const delUrls = (dbImgs||[]).filter(r=>toDelete.includes(r.id)).map(r=>r.image_url).filter(Boolean);
        if(delUrls.length) await r2Delete({ urls: delUrls });
        await supabase.from('images').delete().in('id', toDelete);
      }

      // 갤러리: INSERT -> 업로드 -> URL 업데이트
      for(const it of galleryItems){
        if(!it.file) continue;

        const { data: ins, error: insErr } = await supabase
          .from('images')
          .insert([{ work_id: workId, image_url: null, images_order_index: null }])
          .select('id, seq').single();
        if(insErr) throw insErr;

        const url = await uploadToR2(it.file, { workId, slug, kind:'gallery', seq: ins.seq });
        uploadedUrls.push(url);

        const { error: upErr } = await supabase.from('images').update({ image_url: url }).eq('id', ins.id);
        if(upErr) throw upErr;

        it.id = ins.id; it.url = url; delete it.file;
      }

      // 최종 순서 == 화면 순서
      const orderArr = galleryItems.filter(x=>x.id).map((x,i)=>({ id:x.id, idx:i+1 }));
      if(orderArr.length){
        const { error } = await supabase.rpc('reorder_images', { p_work_id: workId, arr: orderArr });
        if(error) throw error;
      }

      toast('저장 완료!','success');
      closeSheet();
      await loadWorks();
      queueDeploy('work saved/updated');
    }catch(e){
      console.error('저장 실패 - 롤백 시도', e);
      try {
        if(uploadedUrls.length) await r2Delete({ urls: uploadedUrls });
        if(createdWorkId){
          await supabase.from('images').delete().eq('work_id', createdWorkId);
          await supabase.from('works').delete().eq('id', createdWorkId);
        }
      } catch(rollbackErr){ console.warn('롤백 중 오류', rollbackErr); }
      Swal.fire({ icon:'error', title:'저장 실패', text: e.message||'네트워크 오류' });
    }finally{
      hideLoading(); IS_SAVING=false;
      const b=$('#sheet-save'); if(b){ b.disabled=false; b.classList.remove('disabled'); }
    }
  }

  // 트리거
  $('#add-work-btn').addEventListener('click', ()=> openSheet('create'));
  document.addEventListener('dblclick',(e)=>{ const row=e.target.closest('.row'); if(!row) return; openSheet('edit', row.dataset.id); });

  // 모바일: 더블클릭 대신 탭으로 편집 열기
  if(('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)){
    $('#works-list').addEventListener('click', (e)=>{
      if(e.target.closest('.del-work') || e.target.closest('.drag') || e.target.closest('button')) return;
      const row = e.target.closest('.row'); if(!row) return;
      openSheet('edit', row.dataset.id);
    });
  }

  // 시작!
  initPage();
}

const supabase = window.supabase.createClient(
  'https://feprvneoartflrnmefxz.supabase.co',
  'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
);

const workId = new URLSearchParams(window.location.search).get('id');
let images = [];
let currentIndex = 0;
let startX = 0;
let currentTranslate = 0;
let isDragging = false;



async function loadWorkAndImages() {
  console.log('📡 loadWorkAndImages 시작됨');

  const { data: work, error: workError } = await supabase
    .from('works')
    .select('*')
    .eq('id', workId)
    .single();

  if (workError || !work) {
    console.error('❌ 프로젝트 정보 불러오기 실패', workError);
    return;
  }

  console.log('✅ 프로젝트 불러오기 성공', work);

  document.getElementById('work-title').textContent = work.title || '';
  document.getElementById('work-subtitle').textContent = work.subtitle || '';
  document.getElementById('work-since').textContent = work.since || '';



  // 2. images 정보 불러오기
  const { data: imgs, error: imgError } = await supabase
    .from('images')
    .select('*')
    .eq('work_id', workId)
    .order('images_order_index', { ascending: true });

  if (imgError || !imgs || imgs.length === 0) {
    document.getElementById('gallery').innerHTML = '이미지 없음';
    return;
  }

  images = imgs;
  renderTrack();
  renderDots();
  updatePosition();
}

function renderTrack() {
  const track = document.getElementById('galleryTrack');
  const wrapper = document.getElementById('gallery'); // ✅ wrapper는 항상 화면 안에 있음

  // 이미지 채워넣기
  track.innerHTML = images
    .map(img => `<img src="${img.image_url}" draggable="false" >`)
    .join('');

  // ✅ 드래그 시작은 wrapper에 걸어야 트랙 밀려도 작동함
  wrapper.addEventListener('mousedown', dragStart);
  wrapper.addEventListener('touchstart', dragStart, { passive: true });

  // ✅ 드래그 중/끝은 항상 document 전체에 걸어야 안전함
  document.addEventListener('mousemove', dragMove);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('touchmove', dragMove, { passive: false });
  document.addEventListener('touchend', dragEnd);
}

function renderDots() {
  const pag = document.querySelector('.gallery-pagination');
  pag.innerHTML = images.map((_, i) => `<span class="page-dot${i === currentIndex ? ' active' : ''}"></span>`).join('');
}

function updatePosition(animate = true) {
  const track = document.getElementById('galleryTrack');
  currentTranslate = -currentIndex * track.offsetWidth;
  if (animate) track.style.transition = 'transform 0.3s ease';
  else track.style.transition = 'none';
  track.style.transform = `translateX(${currentTranslate}px)`;
  renderDots();
}

function dragStart(e) {
  if ((e.touches && e.touches.length > 1)) return;
  isDragging = true;
  startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  document.getElementById('galleryTrack').style.transition = 'none';
}

function dragMove(e) {
  if (!isDragging || (e.touches && e.touches.length > 1)) return;  // ✅ 두 손가락이면 무시
  e.preventDefault();
  const x = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  const dx = x - startX;
  const track = document.getElementById('galleryTrack');
  track.style.transform = `translateX(${currentTranslate + dx}px)`;
}

function dragEnd(e) {
    if (!isDragging || (e.changedTouches && e.changedTouches.length > 1)) return;  // ✅ 두 손가락이면 무시
  const endX = e.type.includes('mouse') ? e.clientX : e.changedTouches[0].clientX;
  const dx = endX - startX;
  const threshold = window.innerWidth * 0.07;

  if (dx > threshold && currentIndex > 0) currentIndex--;
  else if (dx < -threshold && currentIndex < images.length - 1) currentIndex++;

  isDragging = false;
  updatePosition();
}

loadWorkAndImages();
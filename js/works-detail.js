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

const $ = (s) => document.querySelector(s);

async function loadWorkAndImages() {
  // 1) work 메타
  const { data: work, error: workError } = await supabase
    .from('works').select('*').eq('id', workId).single();
  if (workError || !work) {
    console.error('프로젝트 로드 실패', workError);
    return;
  }

  $('#work-title').textContent = work.title || '';
  $('#work-subtitle').textContent = work.subtitle || '';
  $('#work-since').textContent = work.since || '';

  // 2) 이미지 목록
  const { data: imgs, error: imgError } = await supabase
    .from('images')
    .select('*')
    .eq('work_id', workId)
    .order('images_order_index', { ascending: true });

  if (imgError || !imgs || !imgs.length) {
    $('#gallery').innerHTML = '이미지 없음';
    return;
  }

  images = imgs;
  renderTrack();
  renderDots();
  updatePosition(false);
}

function renderTrack() {
  const track = $('#galleryTrack');
  const wrapper = $('#gallery');

  track.innerHTML = images
    .map((img, i) => `<img src="${img.image_url}" alt="image ${i + 1}" draggable="false" loading="eager">`)
    .join('');

  // 이벤트 중복 바인딩 방지
  if (renderTrack._bound) return;

  wrapper.addEventListener('mousedown', dragStart);
  wrapper.addEventListener('touchstart', dragStart, { passive: true });

  document.addEventListener('mousemove', dragMove);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('touchmove', dragMove, { passive: false });
  document.addEventListener('touchend', dragEnd);

  window.addEventListener('resize', () => updatePosition(false));
  window.addEventListener('orientationchange', () => updatePosition(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });

  renderTrack._bound = true;
}

function renderDots() {
  const pag = document.querySelector('.gallery-pagination');
  pag.innerHTML = images
    .map((_, i) => `<button class="page-dot${i === currentIndex ? ' active' : ''}" data-idx="${i}" aria-label="go to slide ${i + 1}"></button>`)
    .join('');

  pag.onclick = (e) => {
    const btn = e.target.closest('.page-dot');
    if (!btn) return;
    currentIndex = +btn.dataset.idx;
    updatePosition();
  };
}

function viewportWidth() {
  return $('#gallery').clientWidth || $('#gallery').offsetWidth;
}

function updatePosition(animate = true) {
  const track = $('#galleryTrack');

  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex > images.length - 1) currentIndex = images.length - 1;

  currentTranslate = -currentIndex * viewportWidth();
  track.style.transition = animate ? 'transform 0.3s ease' : 'none';
  track.style.transform = `translate3d(${currentTranslate}px,0,0)`;

  // 점 업데이트
  document.querySelectorAll('.page-dot').forEach((d, i) => {
    d.classList.toggle('active', i === currentIndex);
  });
}

function dragStart(e) {
  if (e.touches && e.touches.length > 1) return; // 멀티터치 방지
  isDragging = true;
  startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  $('#galleryTrack').style.transition = 'none';
}

function dragMove(e) {
  if (!isDragging || (e.touches && e.touches.length > 1)) return;
  e.preventDefault();
  const x = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  const dx = x - startX;
  $('#galleryTrack').style.transform = `translate3d(${currentTranslate + dx}px,0,0)`;
}

function dragEnd(e) {
  if (!isDragging || (e.changedTouches && e.changedTouches.length > 1)) return;
  const endX = e.type.includes('mouse') ? e.clientX : e.changedTouches[0].clientX;
  const dx = endX - startX;
  const threshold = Math.max(40, viewportWidth() * 0.07);

  if (dx > threshold) go(-1);
  else if (dx < -threshold) go(1);
  else updatePosition(); // 되돌리기

  isDragging = false;
}

function go(dir) {
  currentIndex += dir;
  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex > images.length - 1) currentIndex = images.length - 1;
  updatePosition();
}

loadWorkAndImages();

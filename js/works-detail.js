const supabase = window.supabase.createClient(
  'https://feprvneoartflrnmefxz.supabase.co',
  'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
);

const workId = new URLSearchParams(window.location.search).get('id');

let images = [];
let currentIndex = 1;      // ★ 시작을 1로(왼쪽엔 마지막 클론, 오른쪽엔 첫 클론)
let startX = 0;
let currentTranslate = 0;
let isDragging = false;

// ★ 클론 포함 총 슬라이드 개수
let totalSlides = 0;

// 상태/큐/유틸
let isAnimating = false;   // 애니 진행중 플래그
let pendingSteps = 0;      // 애니 중 들어온 go()를 모아두는 큐
let dragStartTime = 0;     // 속도 계산(선택)

function getCurrentTranslateX(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const m = new DOMMatrixReadOnly(t);
  return m.m41; // translateX
}

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
  await preloadFirstSlides(); // 보이는 첫 장 디코드 대기(옵션)
  renderDots();
  updatePosition(false); // 첫 배치: 애니 없이
}

function renderTrack() {
  const track = $('#galleryTrack');
  const wrapper = $('#gallery');

  // ★ [lastClone, ...originals, firstClone] 구성
  const slides = [
    images[images.length - 1],
    ...images,
    images[0]
  ];
  totalSlides = slides.length;

  track.innerHTML = slides
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

  // ★ 애니 끝나면 클론 위치 → 진짜 위치로 순간 점프, 큐 처리
  track.addEventListener('transitionend', (e) => {
    if (e.target !== track || e.propertyName !== 'transform') return;

    const lastReal = images.length;
    if (currentIndex === 0) {
      currentIndex = lastReal;   // 왼쪽 끝클론 -> 진짜 마지막
      jumpWithoutAnim();
    } else if (currentIndex === lastReal + 1) {
      currentIndex = 1;          // 오른쪽 끝클론 -> 진짜 첫 장
      jumpWithoutAnim();
    }

    isAnimating = false;

    // 큐 처리: 한 스텝씩 소진
    if (pendingSteps !== 0) {
      const step = pendingSteps > 0 ? 1 : -1;
      pendingSteps -= step;
      currentIndex += step;
      updatePosition(); // 다음 애니에서 또 처리
    }
  });

  renderTrack._bound = true;
}

function renderDots() {
  const pag = document.querySelector('.gallery-pagination');
  pag.innerHTML = images
    .map((_, i) => `<button class="page-dot" data-real="${i}" aria-label="go to slide ${i + 1}"></button>`)
    .join('');

  pag.onclick = (e) => {
    const btn = e.target.closest('.page-dot');
    if (!btn) return;
    const real = +btn.dataset.real; // 0..images.length-1
    currentIndex = real + 1;        // ★ 클론 보정
    updatePosition();
  };

  updateDots(); // 초기 활성화
}

function updateDots() {
  const real = realIndex();
  document.querySelectorAll('.page-dot').forEach((d, i) => {
    d.classList.toggle('active', i === real);
  });
}

// ★ 현재 클론 보정된 원본 인덱스(0..len-1)
function realIndex() {
  let idx = currentIndex - 1; // 0..images.length (클론 포함 보정)
  if (idx < 0) idx = images.length - 1;
  if (idx >= images.length) idx = 0;
  return idx;
}

function viewportWidth() {
  return $('#gallery').getBoundingClientRect().width;
}

function updatePosition(animate = true) {
  const track = $('#galleryTrack');

  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex > totalSlides - 1) currentIndex = totalSlides - 1;

  const target = -currentIndex * viewportWidth();

  // 이전 위치와 비교해서 실제 이동이 있을 때만 애니
  const prev = getCurrentTranslateX(track);
  const delta = Math.abs(target - prev);
  const doAnimate = animate && delta > 0.5; // 0.5px 이하는 동일 취급

  isAnimating = doAnimate;
  currentTranslate = target;
  track.style.transition = doAnimate ? 'transform 0.26s cubic-bezier(.22,.61,.36,1)' : 'none';
  track.style.transform  = `translate3d(${target}px,0,0)`;

  updateDots();

  // transitionend 누락 대비 안전 타이머
  clearTimeout(track._animTimer);
  if (doAnimate) {
    track._animTimer = setTimeout(() => {
      if (!isAnimating) return;
      isAnimating = false;
      if (pendingSteps !== 0) {
        const step = pendingSteps > 0 ? 1 : -1;
        pendingSteps -= step;
        currentIndex += step;
        updatePosition();
      }
    }, 420);
  }
}

// ★ 트랜지션 없이 현재 인덱스로 즉시 이동(점프)
function jumpWithoutAnim() {
  const track = $('#galleryTrack');
  const x = -currentIndex * viewportWidth();
  track.style.transition = 'none';
  track.style.transform = `translate3d(${x}px,0,0)`;
  currentTranslate = x;
}

function dragStart(e) {
  if (e.touches && e.touches.length > 1) return; // 멀티터치 방지
  const track = $('#galleryTrack');

  // 애니 중이면 즉시 끊고 현재 프레임 이어받기
  if (isAnimating) {
    const x = getCurrentTranslateX(track);
    currentTranslate = x;

    const vw = Math.max(1, viewportWidth());
    const approx = -Math.round(x / vw);
    currentIndex = Math.max(0, Math.min(totalSlides - 1, approx));

    track.style.transition = 'none';
    track.style.transform  = `translate3d(${currentTranslate}px,0,0)`;
    isAnimating  = false;
    pendingSteps = 0; // 드래그 시작 시 큐 비우기
  }

  isDragging = true;
  startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
  $('#galleryTrack').style.transition = 'none';

  // 드래그 시작 시 기준값 동기화(안전)
  currentTranslate = -currentIndex * viewportWidth();
  $('#galleryTrack').style.transform = `translate3d(${currentTranslate}px,0,0)`;
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
  // 애니 중이면 큐에 쌓고 리턴
  if (isAnimating) {
    pendingSteps += dir;
    const N = images.length;
    if (pendingSteps >  N) pendingSteps =  N;
    if (pendingSteps < -N) pendingSteps = -N;
    return;
  }

  const lastReal = images.length;

  // 이동 전에: 클론에 서 있으면 먼저 무애니 정규화(점프)
  if (currentIndex === 0) {
    currentIndex = lastReal;    // 마지막 진짜
    jumpWithoutAnim();
  } else if (currentIndex === lastReal + 1) {
    currentIndex = 1;           // 첫 번째 진짜
    jumpWithoutAnim();
  }

  // 이제 정확히 한 칸만 애니로 이동
  currentIndex += dir;
  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex > totalSlides - 1) currentIndex = totalSlides - 1;
  updatePosition();
}

// 가운데 첫 장들 디코드 대기(옵션, 첫 넘김 버벅 제거)
async function preloadFirstSlides() {
  const track = $('#galleryTrack');
  const imgs = track.querySelectorAll('img');
  const base = 1; // 첫 원본 위치(클론 보정)
  const idxs = [base, base + 1].filter(i => i >= 0 && i < imgs.length);
  await Promise.allSettled(idxs.map(i => imgs[i]?.decode?.() ?? Promise.resolve()));
}

loadWorkAndImages();
